const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database tables
const initDatabase = () => {
  // Students table (separated by class_id)
  db.exec(`CREATE TABLE IF NOT EXISTS students (
    class_id TEXT NOT NULL,
    roll_number TEXT NOT NULL,
    name TEXT NOT NULL,
    PRIMARY KEY (class_id, roll_number)
  )`);

  // Attendance table (separated by class_id)
  db.exec(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id TEXT NOT NULL,
    date TEXT NOT NULL,
    roll_number TEXT NOT NULL,
    lecture_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    FOREIGN KEY (class_id, roll_number) REFERENCES students (class_id, roll_number)
  )`);

  // Users table
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    class_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('CR', 'LR'))
  )`);
};

// Add a student
const addStudent = (classId, rollNumber, name) => {
  const stmt = db.prepare(
    'INSERT INTO students (class_id, roll_number, name) VALUES (?, ?, ?)'
  );
  stmt.run(classId, rollNumber, name);
  return { classId, rollNumber, name };
};

// Get student by roll number
const getStudent = (classId, rollNumber) => {
  const stmt = db.prepare(
    'SELECT * FROM students WHERE class_id = ? AND roll_number = ?'
  );
  return stmt.get(classId, rollNumber);
};

// Get all students for a class
const getAllStudents = (classId) => {
  const stmt = db.prepare(
    'SELECT * FROM students WHERE class_id = ? ORDER BY roll_number ASC'
  );
  return stmt.all(classId);
};

// Get total unique lectures between dates for a class
const getLectureCountBetweenDates = (classId, date1, date2) => {
  const stmt = db.prepare(
    'SELECT COUNT(DISTINCT date || "_" || lecture_number) as count FROM attendance WHERE class_id = ? AND date BETWEEN ? AND ?'
  );
  const row = stmt.get(classId, date1, date2);
  return row ? row.count : 0;
};

// Get all attendance for a student in a class
const getStudentAttendance = (classId, rollNumber) => {
  const stmt = db.prepare(
    'SELECT * FROM attendance WHERE class_id = ? AND roll_number = ?'
  );
  return stmt.all(classId, rollNumber);
};

// Get attendance statistics for all students in a class
const getAllAttendanceStats = (classId) => {
  const stmt = db.prepare(`
    SELECT 
      s.roll_number, 
      s.name,
      COUNT(a.id) as total_lectures,
      SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as attended
    FROM students s
    LEFT JOIN attendance a ON s.class_id = a.class_id AND s.roll_number = a.roll_number
    WHERE s.class_id = ?
    GROUP BY s.roll_number
  `);
  return stmt.all(classId);
};

// Mark attendance
const markAttendance = (classId, date, rollNumber, lectureNumber, status) => {
  const stmt = db.prepare(
    'INSERT INTO attendance (class_id, date, roll_number, lecture_number, status) VALUES (?, ?, ?, ?, ?)'
  );
  const result = stmt.run(classId, date, rollNumber, lectureNumber, status);
  return { id: result.lastInsertRowid, classId, date, rollNumber, lectureNumber, status };
};

// Update attendance
const updateAttendance = (classId, date, rollNumber, lectureNumber, status) => {
  const stmt = db.prepare(
    'UPDATE attendance SET status = ? WHERE class_id = ? AND date = ? AND roll_number = ? AND lecture_number = ?'
  );
  const result = stmt.run(status, classId, date, rollNumber, lectureNumber);
  return { changes: result.changes };
};

// Get attendance for a specific date and roll number in a class
const getAttendance = (classId, date, rollNumber) => {
  if (rollNumber) {
    const stmt = db.prepare(
      'SELECT * FROM attendance WHERE class_id = ? AND date = ? AND roll_number = ?'
    );
    return stmt.all(classId, date, rollNumber);
  } else {
    const stmt = db.prepare(
      'SELECT * FROM attendance WHERE class_id = ? AND date = ?'
    );
    return stmt.all(classId, date);
  }
};

// Login verification
const verifyUser = (classId, password) => {
  const stmt = db.prepare(
    'SELECT * FROM users WHERE class_id = ? AND password = ?'
  );
  return stmt.get(classId, password);
};

// Check if attendance already exists
const checkDuplicateAttendance = (classId, date, rollNumber, lectureNumber) => {
  const stmt = db.prepare(
    'SELECT id FROM attendance WHERE class_id = ? AND date = ? AND roll_number = ? AND lecture_number = ?'
  );
  return stmt.get(classId, date, rollNumber, lectureNumber);
};

module.exports = {
  initDatabase,
  addStudent,
  getStudent,
  getAllStudents,
  getLectureCountBetweenDates,
  getStudentAttendance,
  getAllAttendanceStats,
  markAttendance,
  updateAttendance,
  getAttendance,
  verifyUser,
  checkDuplicateAttendance,
  db,
};
