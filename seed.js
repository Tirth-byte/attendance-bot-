const { db, initDatabase } = require('./utils/database');

// Ensure tables are created
initDatabase();

const classId = 'CS101';
const username = 'AdminCR';
const password = 'password123';
const role = 'CR';

try {
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO users (class_id, username, password, role) VALUES (?, ?, ?, ?)'
  );
  stmt.run(classId, username, password, role);

  console.log(`User seeded successfully!`);
  console.log(`Class ID: ${classId}`);
  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);
  console.log(`Role: ${role}`);
  console.log('\nYou can now login in Discord using: !login CS101 password123');
} catch (err) {
  console.error('Error seeding user:', err.message);
} finally {
  db.close();
}
