require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { 
  initDatabase, 
  verifyUser, 
  markAttendance, 
  updateAttendance,
  checkDuplicateAttendance,
  addStudent,
  getStudent,
  getStudentAttendance,
  getAllAttendanceStats,
  getAllStudents,
  getAttendance,
  getLectureCountBetweenDates
} = require('./utils/database');

// Initialize database
initDatabase();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// In-memory session store: Map<DiscordUserID, UserData & SessionState>
const sessions = new Map();

client.once('ready', () => {
  console.log('Bot is online');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  // Public command: !login
  if (command === '!login') {
    const classId = args[1];
    const password = args[2];

    if (!classId || !password) {
      return message.reply('Usage: !login <class_id> <password>');
    }

    try {
      const user = await verifyUser(classId, password);
      if (user) {
        // Only CR or LR roles are allowed to log in and use the bot
        if (user.role === 'CR' || user.role === 'LR') {
          sessions.set(message.author.id, {
            ...user,
            currentDate: new Date().toISOString().split('T')[0], // Default to today
            lectureCount: 0
          });
          message.reply(`Welcome ${user.username} (${user.role})! You are now logged in for class **${user.class_id}**. Current date set to ${sessions.get(message.author.id).currentDate}`);
        } else {
          message.reply('Access denied. Only Class Representatives (CR) and Lady Representatives (LR) can use this bot.');
        }
      } else {
        message.reply('Invalid class ID or password.');
      }
    } catch (error) {
      console.error(error);
      message.reply('An error occurred during login.');
    }
    return;
  }

  // Middleware: Check if logged in AND is CR/LR
  if (!sessions.has(message.author.id)) {
    if (message.content.startsWith('!')) {
      return message.reply('Please login first using `!login <class_id> <password>`. Only CR/LR accounts are authorized.');
    }
    return;
  }

  const session = sessions.get(message.author.id);

  // Handle CSV upload for bulk student import
  if (message.attachments.size > 0) {
    const attachment = message.attachments.first();
    if (attachment.name.endsWith('.csv')) {
      const filePath = path.join(__dirname, attachment.name);
      const file = fs.createWriteStream(filePath);

      https.get(attachment.url, (response) => {
        response.pipe(file);
        file.on('finish', async () => {
          file.close();
          
          try {
            const data = fs.readFileSync(filePath, 'utf8');
            const lines = data.split(/\r?\n/).filter(line => line.trim() !== '');
            let addedCount = 0;
            let skippedCount = 0;

            for (const line of lines) {
              const [roll, name] = line.split(',').map(item => item.trim());
              if (roll && name) {
                const existing = await getStudent(session.class_id, roll);
                if (!existing) {
                  await addStudent(session.class_id, roll, name);
                  addedCount++;
                } else {
                  skippedCount++;
                }
              }
            }

            if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Cleanup
            message.reply(`CSV Import Complete for class **${session.class_id}**: **${addedCount}** students added, **${skippedCount}** duplicates skipped.`);
          } catch (error) {
            console.error(error);
            message.reply('An error occurred while processing the CSV file.');
          }
        });
      }).on('error', (err) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error(err);
        message.reply('Failed to download the CSV file.');
      });
      return;
    }
  }

  // Logged-in commands
  if (command === '!setdate') {
    const dateStr = args[1];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateStr || !dateRegex.test(dateStr)) {
      return message.reply('Usage: !setdate <YYYY-MM-DD>');
    }

    session.currentDate = dateStr;
    message.reply(`Working date set to: **${dateStr}**`);
  } 
  
  else if (command === '!setlectures') {
    const count = parseInt(args[1]);

    if (isNaN(count) || count < 1) {
      return message.reply('Usage: !setlectures <number> (must be a positive number)');
    }

    session.lectureCount = count;
    message.reply(`Lecture count for the day set to: **${count}**`);
  }

  else if (command === '!addstudent') {
    const roll = args[1];
    const name = args.slice(2).join(' ');

    if (!roll || !name) {
      return message.reply('Usage: !addstudent <roll> <name>');
    }

    try {
      const existing = await getStudent(session.class_id, roll);
      if (existing) {
        return message.reply(`Student with Roll Number **${roll}** already exists in class **${session.class_id}**: **${existing.name}**.`);
      }

      await addStudent(session.class_id, roll, name);
      message.reply(`Added student to class **${session.class_id}**: **${name}** (Roll: **${roll}**)`);
    } catch (error) {
      console.error(error);
      message.reply('An error occurred while adding the student.');
    }
  }

  else if (command === '!mark') {
    const roll = args[1];
    const lectureNum = parseInt(args[2]);
    const status = args[3] ? args[3].toLowerCase() : null;

    if (!roll || isNaN(lectureNum) || !['present', 'absent', 'p', 'a'].includes(status)) {
      return message.reply('Usage: !mark <roll> <lecture_number> <present/absent>');
    }

    const normalizedStatus = (status === 'p' || status === 'present') ? 'Present' : 'Absent';

    if (session.lectureCount === 0) {
      return message.reply('Please set the lecture count for the day first using `!setlectures <number>`.');
    }

    if (lectureNum < 1 || lectureNum > session.lectureCount) {
      return message.reply(`Invalid lecture number. It must be between 1 and ${session.lectureCount}.`);
    }

    try {
      const existing = await checkDuplicateAttendance(session.class_id, session.currentDate, roll, lectureNum);
      if (existing) {
        return message.reply(`Attendance already marked for Roll: ${roll}, Lecture: ${lectureNum} on ${session.currentDate} (Class: ${session.class_id}).`);
      }

      await markAttendance(session.class_id, session.currentDate, roll, lectureNum, normalizedStatus);
      message.reply(`Marked **${normalizedStatus}** for Roll: **${roll}**, Lecture: **${lectureNum}** on **${session.currentDate}** (Class: ${session.class_id}).`);
    } catch (error) {
      console.error(error);
      message.reply('An error occurred while marking attendance.');
    }
  }

  else if (command === '!change') {
    const roll = args[1];
    const date = args[2];
    const lectureNum = parseInt(args[3]);
    const status = args[4] ? args[4].toLowerCase() : null;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!roll || !date || !dateRegex.test(date) || isNaN(lectureNum) || !['present', 'absent', 'p', 'a'].includes(status)) {
      return message.reply('Usage: !change <roll> <date> <lecture_number> <present/absent>');
    }

    const normalizedStatus = (status === 'p' || status === 'present') ? 'Present' : 'Absent';

    try {
      const existing = await checkDuplicateAttendance(session.class_id, date, roll, lectureNum);
      if (!existing) {
        return message.reply(`No attendance record found for Roll: ${roll}, Date: ${date}, Lecture: ${lectureNum} to update in class ${session.class_id}.`);
      }

      await updateAttendance(session.class_id, date, roll, lectureNum, normalizedStatus);
      message.reply(`Updated attendance to **${normalizedStatus}** for Roll: **${roll}**, Date: **${date}**, Lecture: **${lectureNum}** (Class: ${session.class_id}).`);
    } catch (error) {
      console.error(error);
      message.reply('An error occurred while updating attendance.');
    }
  }

  else if (command === '!report') {
    const roll = args[1];
    if (!roll) {
      return message.reply('Usage: !report <roll>');
    }

    try {
      const student = await getStudent(session.class_id, roll);
      if (!student) {
        return message.reply(`Student with roll number **${roll}** not found in class **${session.class_id}**.`);
      }

      const attendanceRecords = await getStudentAttendance(session.class_id, roll);
      const totalLectures = attendanceRecords.length;
      const attended = attendanceRecords.filter(r => r.status === 'Present').length;
      const absent = totalLectures - attended;
      const percentage = totalLectures > 0 ? ((attended / totalLectures) * 100).toFixed(2) : 0;

      const reportContent = [
        `Attendance Report for ${student.name} (Roll: ${student.roll_number})`,
        `Class ID: ${session.class_id}`,
        `--------------------------------------------------`,
        `Total Lectures: ${totalLectures}`,
        `Attended:       ${attended}`,
        `Absent:         ${absent}`,
        `Percentage:     ${percentage}%`,
        `--------------------------------------------------`,
        `Detailed Logs:`,
        ...attendanceRecords.map(r => `${r.date} | Lecture ${r.lecture_number} | ${r.status}`)
      ].join('\n');

      const fileName = `report_${session.class_id}_${roll}.txt`;
      const filePath = path.join(__dirname, fileName);
      fs.writeFileSync(filePath, reportContent);

      const attachment = new AttachmentBuilder(filePath);

      await message.reply({
        content: `Attendance report for **${student.name}** (Roll: **${roll}**, Class: **${session.class_id}**):`,
        files: [attachment]
      });

      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
      console.error(error);
      message.reply('An error occurred while generating the report.');
    }
  }

  else if (command === '!low') {
    try {
      const stats = await getAllAttendanceStats(session.class_id);
      const lowAttendanceList = stats
        .map(s => {
          const total = s.total_lectures || 0;
          const attended = s.attended || 0;
          const percentage = total > 0 ? (attended / total) * 100 : 0;
          return { ...s, percentage };
        })
        .filter(s => s.percentage < 70)
        .sort((a, b) => a.percentage - b.percentage);

      if (lowAttendanceList.length === 0) {
        return message.reply(`All students in class **${session.class_id}** have attendance above 70%!`);
      }

      let response = `**Students with Low Attendance (Below 70%) in Class ${session.class_id}:**\n\`\`\`\n`;
      response += 'Roll | Name                 | %    \n';
      response += '------------------------------------\n';
      
      lowAttendanceList.forEach(s => {
        const rollStr = s.roll_number.padEnd(4);
        const nameStr = s.name.substring(0, 20).padEnd(20);
        const percentStr = s.percentage.toFixed(1).padStart(5) + '%';
        response += `${rollStr} | ${nameStr} | ${percentStr}\n`;
      });
      
      response += '\`\`\`';
      message.reply(response);
    } catch (error) {
      console.error(error);
      message.reply('An error occurred while checking low attendance.');
    }
  }

  else if (command === '!high') {
    try {
      const stats = await getAllAttendanceStats(session.class_id);
      const highAttendanceList = stats
        .map(s => {
          const total = s.total_lectures || 0;
          const attended = s.attended || 0;
          const percentage = total > 0 ? (attended / total) * 100 : 0;
          return { ...s, percentage };
        })
        .filter(s => s.percentage > 95)
        .sort((a, b) => b.percentage - a.percentage);

      if (highAttendanceList.length === 0) {
        return message.reply(`No students in class **${session.class_id}** have attendance above 95% yet.`);
      }

      const reportContent = [
        `High Attendance Report (Above 95%) - Class: ${session.class_id}`,
        `Generated on: ${new Date().toLocaleString()}`,
        `--------------------------------------------------`,
        `Roll | Name                 | Attended/Total | Percentage`,
        `--------------------------------------------------`,
        ...highAttendanceList.map(s => {
          const rollStr = s.roll_number.padEnd(4);
          const nameStr = s.name.substring(0, 20).padEnd(20);
          const ratioStr = `${s.attended}/${s.total_lectures}`.padStart(14);
          const percentStr = `${s.percentage.toFixed(2)}%`.padStart(11);
          return `${rollStr} | ${nameStr} | ${ratioStr} | ${percentStr}`;
        })
      ].join('\n');

      const fileName = `high_attendance_${session.class_id}.txt`;
      const filePath = path.join(__dirname, fileName);
      fs.writeFileSync(filePath, reportContent);

      const attachment = new AttachmentBuilder(filePath);

      await message.reply({
        content: `Students with high attendance in class **${session.class_id}** (Above 95%):`,
        files: [attachment]
      });

      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
      console.error(error);
      message.reply('An error occurred while checking high attendance.');
    }
  }

  else if (command === '!check') {
    const dateStr = args[1];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateStr || !dateRegex.test(dateStr)) {
      return message.reply('Usage: !check <YYYY-MM-DD>');
    }

    try {
      const allStudents = await getAllStudents(session.class_id);
      const attendanceOnDate = await getAttendance(session.class_id, dateStr);

      if (attendanceOnDate.length === 0) {
        return message.reply(`No attendance records found for **${dateStr}** in class **${session.class_id}**.`);
      }

      const lecturesHeld = [...new Set(attendanceOnDate.map(a => a.lecture_number))].sort((a, b) => a - b);
      
      let reportContent = [
        `Attendance Summary for Class: ${session.class_id} | Date: ${dateStr}`,
        `Lectures held: ${lecturesHeld.join(', ')}`,
        `--------------------------------------------------`,
        `Roll | Name                 | ${lecturesHeld.map(l => `L${l}`.padEnd(4)).join(' | ')}`,
        `--------------------------------------------------`
      ];

      allStudents.forEach(s => {
        const rollStr = s.roll_number.padEnd(4);
        const nameStr = s.name.substring(0, 20).padEnd(20);
        
        const attendanceMap = {};
        attendanceOnDate
          .filter(a => a.roll_number === s.roll_number)
          .forEach(a => {
            attendanceMap[a.lecture_number] = a.status === 'Present' ? 'P' : 'A';
          });

        const lectureStatus = lecturesHeld.map(l => {
          const status = attendanceMap[l] || '-';
          return status.padEnd(4);
        }).join(' | ');

        reportContent.push(`${rollStr} | ${nameStr} | ${lectureStatus}`);
      });

      const fileName = `check_${session.class_id}_${dateStr}.txt`;
      const filePath = path.join(__dirname, fileName);
      fs.writeFileSync(filePath, reportContent.join('\n'));

      const attachment = new AttachmentBuilder(filePath);

      await message.reply({
        content: `Attendance report for class **${session.class_id}** on **${dateStr}**:`,
        files: [attachment]
      });

      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
      console.error(error);
      message.reply('An error occurred while checking attendance for the date.');
    }
  }

  else if (command === '!lecture') {
    const date1 = args[1];
    const date2 = args[2];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!date1 || !date2 || !dateRegex.test(date1) || !dateRegex.test(date2)) {
      return message.reply('Usage: !lecture <YYYY-MM-DD_start> <YYYY-MM-DD_end>');
    }

    try {
      const count = await getLectureCountBetweenDates(session.class_id, date1, date2);
      message.reply(`Total unique lectures in class **${session.class_id}** between **${date1}** and **${date2}**: **${count}**`);
    } catch (error) {
      console.error(error);
      message.reply('An error occurred while counting lectures.');
    }
  }

  else if (command === '!ping') {
    message.reply('Pong!');
  }
});

client.login(process.env.DISCORD_TOKEN);
