import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

/**
 * PUT /api/users/[id]
 * อัปเดตข้อมูลนักศึกษา โดยมีการป้องกันดังนี้:
 * - ตรวจสอบว่าผู้ใช้เข้าสู่ระบบแล้ว (401)
 * - ใช้ User ID จาก Session/Token เท่านั้น ไม่เชื่อ Frontend
 * - ผู้ใช้ทั่วไปแก้ไขได้เฉพาะข้อมูลของตนเอง (403)
 * - Admin/Super Admin สามารถแก้ไขข้อมูลของบุคคลอื่นได้
 * - ส่ง HTTP Status Code ที่เหมาะสม (401, 403, 404)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. ตรวจสอบว่าผู้ใช้เข้าสู่ระบบแล้ว
  const session = await getSession();
  if (!session || !session.id) {
    return Response.json(
      { success: false, error: "กรุณาเข้าสู่ระบบก่อน" },
      { status: 401 }
    );
  }

  const { id: targetUserId } = await params;

  // 2. ใช้ User ID จาก Session เท่านั้น — ห้ามเชื่อ ID ที่ Frontend ส่งมาใน body
  const authenticatedUserId: string = session.id;
  const authenticatedRole: string = session.role;

  // 3. ตรวจสอบสิทธิ์: ผู้ใช้ทั่วไปแก้ไขได้เฉพาะข้อมูลของตนเอง
  const isAdmin = authenticatedRole === "ADMIN" || authenticatedRole === "SUPER_ADMIN";
  const isOwner = authenticatedUserId === targetUserId;

  if (!isOwner && !isAdmin) {
    return Response.json(
      { success: false, error: "คุณไม่มีสิทธิ์แก้ไขข้อมูลของผู้ใช้คนอื่น" },
      { status: 403 }
    );
  }

  // 4. ตรวจสอบว่า user ที่ต้องการแก้ไขมีอยู่จริง
  const existingUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!existingUser) {
    return Response.json(
      { success: false, error: "ไม่พบผู้ใช้ที่ต้องการแก้ไข" },
      { status: 404 }
    );
  }

  // 5. อ่านข้อมูลที่ต้องการอัปเดตจาก body
  let body: { name?: string; studentId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" },
      { status: 400 }
    );
  }

  // 6. สร้าง updateData — อนุญาตเฉพาะ field ที่กำหนดไว้ (whitelist)
  const updateData: Record<string, any> = {};

  if (body.name !== undefined) {
    const trimmedName = body.name.trim();
    if (trimmedName.length === 0) {
      return Response.json(
        { success: false, error: "ชื่อไม่สามารถเป็นค่าว่างได้" },
        { status: 400 }
      );
    }
    updateData.name = trimmedName;
  }

  // studentId อนุญาตให้แก้ไขเฉพาะผู้ที่มี role เป็น STUDENT เท่านั้น
  if (body.studentId !== undefined) {
    if (existingUser.role === "STUDENT") {
      updateData.studentId = body.studentId.trim() || null;
    }
    // ถ้าไม่ใช่ STUDENT ก็ข้ามไปเฉยๆ (silent ignore)
  }

  if (Object.keys(updateData).length === 0) {
    return Response.json(
      { success: false, error: "ไม่มีข้อมูลที่ต้องการอัปเดต" },
      { status: 400 }
    );
  }

  // 7. อัปเดตข้อมูล
  try {
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        studentId: true,
        role: true,
        imageUrl: true,
        updatedAt: true,
      },
    });

    // 8. บันทึก Audit Log
    await createAuditLog(authenticatedUserId, "UPDATE_PROFILE", targetUserId, {
      updatedFields: Object.keys(updateData),
      isAdminAction: !isOwner && isAdmin,
      targetEmail: updatedUser.email,
    });

    return Response.json(
      { success: true, user: updatedUser },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating user profile:", error);

    // Prisma unique constraint violation (e.g. duplicate studentId)
    if (error.code === "P2002") {
      return Response.json(
        { success: false, error: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว" },
        { status: 409 }
      );
    }

    return Response.json(
      { success: false, error: "เกิดข้อผิดพลาดในการอัปเดตข้อมูล" },
      { status: 500 }
    );
  }
}
