-- ==========================================================
-- ฐานข้อมูล: Student Management (ระบบจัดการข้อมูลนักศึกษา)
-- รายวิชา: 4232301 การจัดการฐานข้อมูลอย่างมั่นคงปลอดภัย
-- ผู้จัดทำ: นายปภาวิน วิริยวิชาการ (รหัสนักศึกษา: 6811011662003)
-- มหาวิทยาลัยสวนดุสิต (Suan Dusit University)
-- ==========================================================

-- 1. สร้างฐานข้อมูล (กรณีใช้งานบน MySQL / MariaDB)
CREATE DATABASE IF NOT EXISTS StudentManagement CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE StudentManagement;

-- 2. สร้างตาราง courses (หลักสูตร/รายวิชา)
CREATE TABLE IF NOT EXISTS courses (
    course_id VARCHAR(10) PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL,
    credits INT NOT NULL CHECK (credits > 0),
    instructor VARCHAR(100) NOT NULL
);

-- 3. สร้างตาราง students (นักศึกษา)
CREATE TABLE IF NOT EXISTS students (
    student_id VARCHAR(15) PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    age INT NOT NULL CHECK (age >= 15 AND age <= 100),
    email VARCHAR(100) UNIQUE NOT NULL,
    major VARCHAR(50) NOT NULL
);

-- 4. การเพิ่มข้อมูล (INSERT)
-- 4.1 เพิ่มข้อมูลรายวิชา
INSERT INTO courses (course_id, course_name, credits, instructor) VALUES
('4232301', 'การจัดการฐานข้อมูลอย่างมั่นคงปลอดภัย', 3, 'ดร.สมชาย ใจดี'),
('4232302', 'การพัฒนาเว็บแอปพลิเคชัน', 3, 'อ.วิชัย เก่งการ'),
('4232303', 'โครงสร้างข้อมูลและอัลกอริทึม', 3, 'ผศ.ดร.พรพิมล รัตนศิลป์');

-- 4.2 เพิ่มข้อมูลนักศึกษา
INSERT INTO students (student_id, first_name, last_name, age, email, major) VALUES
('6811011662001', 'นิธิศ', 'เลิศรัชต์', 21, 'nithis.l@sdu.ac.th', 'วิทยาการคอมพิวเตอร์'),
('6811011662002', 'กานต์', 'สุขเกษม', 19, 'karn.s@sdu.ac.th', 'เทคโนโลยีสารสนเทศ'),
('6811011662003', 'ปภาวิน', 'วิริยวิชาการ', 22, 'papawin.w@sdu.ac.th', 'วิทยาการคอมพิวเตอร์'),
('6811011662004', 'อนุกูล', 'บุญทา', 20, 'anukul.b@sdu.ac.th', 'เทคโนโลยีสารสนเทศ'),
('6811011662005', 'ชัญญา', 'ศรีสมบัติ', 23, 'chanya.s@sdu.ac.th', 'วิทยาการข้อมูล');

-- 5. การแสดงข้อมูล (SELECT)
-- 5.1 โจทย์ที่ 1: แสดงรายชื่อนักศึกษาทั้งหมด
SELECT 
    student_id AS 'รหัสนักศึกษา',
    first_name AS 'ชื่อ',
    last_name AS 'นามสกุล',
    age AS 'อายุ',
    email AS 'อีเมล',
    major AS 'สาขาวิชา'
FROM students;

-- 5.2 โจทย์ที่ 2: แสดงนักศึกษาที่มีอายุมากกว่า 20 ปี
SELECT 
    student_id AS 'รหัสนักศึกษา',
    first_name AS 'ชื่อ',
    last_name AS 'นามสกุล',
    age AS 'อายุ',
    email AS 'อีเมล',
    major AS 'สาขาวิชา'
FROM students
WHERE age > 20;

-- 6. การแก้ไขข้อมูล (UPDATE)
-- โจทย์ที่ 3: แก้ไขชื่อข้อมูลนักศึกษา (เปลี่ยนชื่อและอายุของนักศึกษารหัส 6811011662003)
UPDATE students 
SET first_name = 'ปภาวินทร์',
    age = 23
WHERE student_id = '6811011662003';

-- ตรวจสอบผลหลังการแก้ไข
SELECT 
    student_id AS 'รหัสนักศึกษา',
    first_name AS 'ชื่อ',
    last_name AS 'นามสกุล',
    age AS 'อายุ',
    email AS 'อีเมล',
    major AS 'สาขาวิชา'
FROM students
WHERE student_id = '6811011662003';

-- 7. การลบข้อมูล (DELETE)
-- โจทย์ที่ 4: ลบข้อมูลนักศึกษาที่กำหนด (ลบนักศึกษารหัส 6811011662002)
DELETE FROM students 
WHERE student_id = '6811011662002';

-- ตรวจสอบผลหลังการลบ (แสดงรายชื่อนักศึกษาคงเหลือทั้งหมด)
SELECT 
    student_id AS 'รหัสนักศึกษา',
    first_name AS 'ชื่อ',
    last_name AS 'นามสกุล',
    age AS 'อายุ',
    email AS 'อีเมล',
    major AS 'สาขาวิชา'
FROM students;
