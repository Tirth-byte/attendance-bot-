const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
const initDatabase = () => {
  db.serialize(() => {
    // Students table (separated by class_id)
    db.run(`CREATE TABLE IF NOT EXISTS students (
      class_id TEXT NOT NULL,
      roll_number TEXT NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (class_id, roll_number)
    )`);

    // Attendance table (separated by class_id)
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id TEXT NOT NULL,
      date TEXT NOT NULL,
      roll_number TEXT NOT NULL,
      lecture_number INTEGER NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (class_id, roll_number) REFERENCES students (class_id, roll_number)
    )`);

    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      class_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('CR', 'LR'))
    )`);
  });
};

// Add a student
const addStudent = (classId, rollNumber, name) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO students (class_id, roll_number, name) VALUES (?, ?, ?)',
      [classId, rollNumber, name],
      function (err) {
        if (err) reject(err);
        else resolve({ classId, rollNumber, name });
      }
    );
  });
};

// Get student by roll number
const getStudent = (classId, rollNumber) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM students WHERE class_id = ? AND roll_number = ?',
      [classId, rollNumber],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
};

// Get all students for a class
const getAllStudents = (classId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM students WHERE class_id = ? ORDER BY roll_number ASC', [classId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Get total unique lectures between dates for a class
const getLectureCountBetweenDates = (classId, date1, date2) => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT COUNT(DISTINCT date || "_" || lecture_number) as count FROM attendance WHERE class_id = ? AND date BETWEEN ? AND ?';
    db.get(query, [classId, date1, date2], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.count : 0);
    });
  });
};

// Get all attendance for a student in a class
const getStudentAttendance = (classId, rollNumber) => {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM attendance WHERE class_id = ? AND roll_number = ?',
      [classId, rollNumber],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
};

// Get attendance statistics for all students in a class
const getAllAttendanceStats = (classId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        s.roll_number, 
        s.name,
        COUNT(a.id) as total_lectures,
        SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as attended
      FROM students s
      LEFT JOIN attendance a ON s.class_id = a.class_id AND s.roll_number = a.roll_number
      WHERE s.class_id = ?
      GROUP BY s.roll_number
    `;
    db.all(query, [classId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Mark attendance
const markAttendance = (classId, date, rollNumber, lectureNumber, status) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO attendance (class_id, date, roll_number, lecture_number, status) VALUES (?, ?, ?, ?, ?)',
      [classId, date, rollNumber, lectureNumber, status],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, classId, date, rollNumber, lectureNumber, status });
      }
    );
  });
};

// Update attendance
const updateAttendance = (classId, date, rollNumber, lectureNumber, status) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE attendance SET status = ? WHERE class_id = ? AND date = ? AND roll_number = ? AND lecture_number = ?',
      [status, classId, date, rollNumber, lectureNumber],
      function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      }
    );
  });
};

// Get attendance for a specific date and roll number in a class
const getAttendance = (classId, date, rollNumber) => {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM attendance WHERE class_id = ? AND date = ?';
    let params = [classId, date];

    if (rollNumber) {
      query += ' AND roll_number = ?';
      params.push(rollNumber);
    }

    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Login verification
const verifyUser = (classId, password) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM users WHERE class_id = ? AND password = ?',
      [classId, password],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
};

// Check if attendance already exists
const checkDuplicateAttendance = (classId, date, rollNumber, lectureNumber) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id FROM attendance WHERE class_id = ? AND date = ? AND roll_number = ? AND lecture_number = ?',
      [classId, date, rollNumber, lectureNumber],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
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
