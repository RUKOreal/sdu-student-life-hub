"use server";

import { prisma } from "@/lib/prisma";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { cookies } from "next/headers";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

/**
 * อัปเดตโปรไฟล์ผู้ใช้ พร้อมป้องกันการแก้ไขข้อมูลของคนอื่น
 *
 * @param data - ข้อมูลที่ต้องการอัปเดต (name, studentId)
 * @param targetUserId - (optional) ID ของผู้ใช้ที่ต้องการแก้ไข
 *   - ถ้าไม่ระบุ → แก้ไขข้อมูลของตนเอง
 *   - ถ้าระบุ → ต้องเป็น Admin/Super Admin จึงจะแก้ไขคนอื่นได้
 *
 * ⚠️ User ID ที่ใช้ยืนยันตัวตนดึงจาก Session เสมอ ไม่เชื่อ Frontend
 */
export async function updateProfile(
  data: { name: string; studentId?: string },
  targetUserId?: string
) {
  // 1. ตรวจสอบว่าเข้าสู่ระบบแล้ว
  const session = await getSession();
  if (!session || !session.id) {
    return { success: false, error: "กรุณาเข้าสู่ระบบก่อน", statusCode: 401 };
  }

  // 2. ใช้ User ID จาก Session เท่านั้น (ห้ามเชื่อ Frontend)
  const authenticatedUserId: string = session.id;
  const authenticatedRole: string = session.role;

  // กำหนด target: ถ้าไม่ระบุ targetUserId → แก้ไขตัวเอง
  const effectiveTargetId = targetUserId || authenticatedUserId;

  // 3. ตรวจสอบสิทธิ์: ผู้ใช้ทั่วไปแก้ไขได้เฉพาะข้อมูลของตนเอง
  const isAdmin = authenticatedRole === "ADMIN" || authenticatedRole === "SUPER_ADMIN";
  const isOwner = authenticatedUserId === effectiveTargetId;

  if (!isOwner && !isAdmin) {
    return {
      success: false,
      error: "คุณไม่มีสิทธิ์แก้ไขข้อมูลของผู้ใช้คนอื่น",
      statusCode: 403,
    };
  }

  try {
    // 4. ตรวจสอบว่า user ที่ต้องการแก้ไขมีอยู่จริง
    const existingUser = await prisma.user.findUnique({
      where: { id: effectiveTargetId },
    });

    if (!existingUser) {
      return {
        success: false,
        error: "ไม่พบผู้ใช้ที่ต้องการแก้ไข",
        statusCode: 404,
      };
    }

    // 5. สร้าง updateData — whitelist เฉพาะ field ที่อนุญาต
    const updateData: { name?: string; studentId?: string | null } = {};

    if (data.name) {
      const trimmedName = data.name.trim();
      if (trimmedName.length === 0) {
        return { success: false, error: "ชื่อไม่สามารถเป็นค่าว่างได้" };
      }
      updateData.name = trimmedName;
    }

    // studentId อนุญาตเฉพาะ role STUDENT
    if (existingUser.role === "STUDENT" && data.studentId !== undefined) {
      updateData.studentId = data.studentId.trim() || null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: effectiveTargetId },
      data: updateData,
    });

    // 6. บันทึก Audit Log
    await createAuditLog(authenticatedUserId, "UPDATE_PROFILE", effectiveTargetId, {
      updatedFields: Object.keys(updateData),
      isAdminAction: !isOwner && isAdmin,
      targetEmail: updatedUser.email,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/profile");
    return { success: true, user: updatedUser };
  } catch (error: any) {
    console.error("Update profile error:", error);
    if (error.code === "P2002") {
      return { success: false, error: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว" };
    }
    return { success: false, error: "เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์" };
  }
}

export async function changePassword(data: { currentPassword?: string, newPassword: string }) {
  const session = await getSession();
  if (!session || !session.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return { success: false, error: "ไม่พบผู้ใช้" };

    // Verify current password if user has one (they should)
    if (data.currentPassword) {
      const isValid = await verifyPassword(data.currentPassword, user.password);
      if (!isValid) {
        return { success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
      }
    }

    const hashedNewPassword = await hashPassword(data.newPassword);
    await prisma.user.update({
      where: { id: session.id },
      data: { password: hashedNewPassword },
    });

    return { success: true };
  } catch (error) {
    console.error("Change password error:", error);
    return { success: false, error: "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน" };
  }
}

export async function uploadProfilePicture(formData: FormData) {
  const session = await getSession();
  if (!session || !session.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "ไม่มีไฟล์อัปโหลด" };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/uploads/profiles
    const uploadDir = join(process.cwd(), "public", "uploads", "profiles");
    
    // Create directory if it doesn't exist
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = file.name.split(".").pop();
    const filename = `${session.id}-${uniqueSuffix}.${extension}`;
    const filePath = join(uploadDir, filename);

    // Write file
    await writeFile(filePath, buffer);

    // Save to database
    const imageUrl = `/uploads/profiles/${filename}`;
    await prisma.user.update({
      where: { id: session.id },
      data: { imageUrl },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/profile");

    return { success: true, imageUrl };
  } catch (error) {
    console.error("Upload profile picture error:", error);
    return { success: false, error: "เกิดข้อผิดพลาดในการอัปโหลดรูปโปรไฟล์" };
  }
}
