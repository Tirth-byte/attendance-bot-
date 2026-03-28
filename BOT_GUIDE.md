# 🤖 Attendance Bot — Complete Testing & Usage Guide

---

## 🔐 Default Login Credentials

> Run `node seed.js` once before testing to set up the default user.

| Field      | Value        |
|------------|--------------|
| Class ID   | `CS101`      |
| Password   | `password123`|
| Role       | CR (Class Representative) |

---

## 📋 All Commands — What to Type & What to Expect

### 1. `!ping` — Health Check
```
You type:    !ping
Bot replies: Pong!
```

---

### 2. `!login` — Login to the Bot
```
You type:    !login CS101 password123
Bot replies: Welcome AdminCR (CR)! You are now logged in for class CS101.
             Current date set to 2026-03-29
```
❌ Wrong credentials:
```
You type:    !login CS101 wrongpass
Bot replies: Invalid class ID or password.
```

---

### 3. `!setdate` — Set the Working Date
```
You type:    !setdate 2026-03-29
Bot replies: Working date set to: 2026-03-29
```
❌ Wrong format:
```
You type:    !setdate 29-03-2026
Bot replies: Usage: !setdate <YYYY-MM-DD>
```

---

### 4. `!setlectures` — Set Number of Lectures for the Day
```
You type:    !setlectures 3
Bot replies: Lecture count for the day set to: 3
```

---

### 5. `!addstudent` — Add a Student Manually
```
You type:    !addstudent 101 Aarav Sharma
Bot replies: Added student to class CS101: Aarav Sharma (Roll: 101)
```
❌ Duplicate roll:
```
You type:    !addstudent 101 Aarav Sharma
Bot replies: Student with Roll Number 101 already exists in class CS101: Aarav Sharma.
```

---

### 6. 📂 CSV Upload — Bulk Import Students
Upload the `test_students.csv` file directly in Discord chat (drag & drop).
```
Bot replies: CSV Import Complete for class CS101: 10 students added, 0 duplicates skipped.
```
If you upload again (all duplicates):
```
Bot replies: CSV Import Complete for class CS101: 0 students added, 10 duplicates skipped.
```

---

### 7. `!mark` — Mark Attendance
> ⚠️ Must run `!setlectures` before marking attendance.

```
You type:    !mark 101 1 present
Bot replies: Marked Present for Roll: 101, Lecture: 1 on 2026-03-29 (Class: CS101).

You type:    !mark 102 1 absent
Bot replies: Marked Absent for Roll: 102, Lecture: 1 on 2026-03-29 (Class: CS101).

You type:    !mark 101 1 p     (shorthand for present)
You type:    !mark 102 1 a     (shorthand for absent)
```
❌ Duplicate mark:
```
You type:    !mark 101 1 present   (again)
Bot replies: Attendance already marked for Roll: 101, Lecture: 1 on 2026-03-29 (Class: CS101).
```
❌ Lecture out of range (if setlectures = 3):
```
You type:    !mark 101 5 present
Bot replies: Invalid lecture number. It must be between 1 and 3.
```

---

### 8. `!change` — Correct a Past Attendance Entry
```
You type:    !change 102 2026-03-29 1 present
Bot replies: Updated attendance to Present for Roll: 102, Date: 2026-03-29, Lecture: 1 (Class: CS101).
```
❌ Record not found:
```
You type:    !change 999 2026-03-29 1 present
Bot replies: No attendance record found for Roll: 999, Date: 2026-03-29, Lecture: 1 to update in class CS101.
```

---

### 9. `!report` — Individual Student Attendance Report
```
You type:    !report 101
Bot replies: [Sends a .txt file attachment]
```
File contents:
```
Attendance Report for Aarav Sharma (Roll: 101)
Class ID: CS101
--------------------------------------------------
Total Lectures: 3
Attended:       2
Absent:         1
Percentage:     66.67%
--------------------------------------------------
Detailed Logs:
2026-03-29 | Lecture 1 | Present
2026-03-29 | Lecture 2 | Present
2026-03-29 | Lecture 3 | Absent
```

---

### 10. `!low` — Students with Attendance Below 70%
```
You type:    !low
Bot replies:
Students with Low Attendance (Below 70%) in Class CS101:
Roll | Name                 | %    
------------------------------------
102  | Priya Patel          |  33.3%
103  | Rohan Mehta          |  50.0%
```
✅ If all above 70%:
```
Bot replies: All students in class CS101 have attendance above 70%!
```

---

### 11. `!high` — Students with Attendance Above 95%
```
You type:    !high
Bot replies: [Sends a .txt file attachment with high attendance list]
```
✅ If none above 95%:
```
Bot replies: No students in class CS101 have attendance above 95% yet.
```

---

### 12. `!check` — Full Attendance Sheet for a Date
```
You type:    !check 2026-03-29
Bot replies: [Sends a .txt file attachment]
```
File contents:
```
Attendance Summary for Class: CS101 | Date: 2026-03-29
Lectures held: 1, 2, 3
--------------------------------------------------
Roll | Name                 | L1   | L2   | L3  
--------------------------------------------------
101  | Aarav Sharma         | P    | P    | A   
102  | Priya Patel          | A    | A    | A   
103  | Rohan Mehta          | P    | A    | P   
```

---

### 13. `!lecture` — Count Unique Lectures Between Two Dates
```
You type:    !lecture 2026-03-01 2026-03-29
Bot replies: Total unique lectures in class CS101 between 2026-03-01 and 2026-03-29: 3
```

---

## 🧪 Full Test Flow (Step by Step)

Run these commands **in order** in Discord to test everything:

```
1.  !ping
2.  !login CS101 password123
3.  !setdate 2026-03-29
4.  !setlectures 3
5.  [Upload test_students.csv]
6.  !mark 101 1 p
7.  !mark 102 1 a
8.  !mark 103 1 p
9.  !mark 101 2 p
10. !mark 102 2 a
11. !mark 103 2 a
12. !mark 101 3 a
13. !mark 102 3 a
14. !mark 103 3 p
15. !report 101
16. !check 2026-03-29
17. !low
18. !high
19. !lecture 2026-03-01 2026-03-29
```

---

## 📁 Test Files

| File | Purpose |
|------|---------|
| `test_students.csv` | 10 sample students for bulk CSV import |

### CSV Format
The CSV file must have **no header row**. Each line: `roll_number,name`
```
101,Aarav Sharma
102,Priya Patel
...
```

---

## ⚙️ Setup Reminder

```bash
# 1. Install dependencies
npm install

# 2. Seed the database with default user
node seed.js

# 3. Start the bot
node index.js
```

---

*Generated for Attendance Bot v1.0 | Class: CS101*
