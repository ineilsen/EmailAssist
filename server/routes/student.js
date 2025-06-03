const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/authMiddleware'); // No isAdmin needed here

const router = express.Router();

// POST /api/student/exams/:examId/start - Start an exam
router.post('/exams/:examId/start', authenticateToken, (req, res) => {
  const { examId } = req.params;
  const studentId = req.user.userId; // Assuming userId is in the JWT payload

  // Check if student has already started this exam and it's not finished
  const checkExistingSql = `SELECT id FROM student_exams WHERE student_id = ? AND exam_id = ? AND end_time IS NULL`;
  db.get(checkExistingSql, [studentId, examId], (err, existingStudentExam) => {
    if (err) {
      return res.status(500).json({ message: 'Error checking existing exam status.', error: err.message });
    }
    if (existingStudentExam) {
      return res.status(409).json({ message: 'Exam already started and not finished.', studentExamId: existingStudentExam.id });
    }

    // Fetch exam details to get time_per_question
    const examDetailsSql = `SELECT time_per_question, question_limit FROM exams WHERE id = ?`;
    db.get(examDetailsSql, [examId], (err, exam) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching exam details.', error: err.message });
        }
        if (!exam) {
            return res.status(404).json({ message: 'Exam not found.' });
        }

        const insertSql = `INSERT INTO student_exams (student_id, exam_id, start_time) VALUES (?, ?, CURRENT_TIMESTAMP)`;
        db.run(insertSql, [studentId, examId], function(err) {
          if (err) {
            console.error(err.message);
            return res.status(500).json({ message: 'Error starting exam.', error: err.message });
          }
          const studentExamId = this.lastID;

          // Fetch questions for the exam (without correct answers)
          const questionsSql = `
            SELECT q.id, q.text, q.type, q.options, eq.question_order
            FROM questions q
            JOIN exam_questions eq ON q.id = eq.question_id
            WHERE eq.exam_id = ?
            ORDER BY eq.question_order ASC
          `;
          db.all(questionsSql, [examId], (err, questions) => {
            if (err) {
              console.error(err.message);
              // Note: The student_exam entry is already created. Consider how to handle this partial failure.
              // For now, we'll return an error but the student_exam entry remains.
              return res.status(500).json({ message: 'Error fetching questions for the exam.', error: err.message });
            }
            // Parse options for multiple_choice questions
            const parsedQuestions = questions.map(q => {
              if (q.type === 'multiple_choice' && q.options) {
                try { q.options = JSON.parse(q.options); } catch (e) { console.error("Error parsing options JSON", e); }
              }
              return q;
            });
            res.status(201).json({
              message: 'Exam started successfully.',
              studentExamId: studentExamId,
              questions: parsedQuestions,
              timePerQuestion: exam.time_per_question,
              questionLimit: exam.question_limit
            });
          });
        });
    });
  });
});

// POST /api/student/exams/:studentExamId/questions/:questionId/answer - Submit an answer
router.post('/exams/:studentExamId/questions/:questionId/answer', authenticateToken, (req, res) => {
  const { studentExamId, questionId } = req.params;
  const { answer_text } = req.body; // answer_text can be string or JSON array for multiple choice
  const studentId = req.user.userId;

  if (answer_text == null) { // Check for null or undefined
    return res.status(400).json({ message: 'Answer text is required.' });
  }

  // Verify that the student_exam_id belongs to the authenticated user and is not finished
  const verifyExamSql = `SELECT id FROM student_exams WHERE id = ? AND student_id = ? AND end_time IS NULL`;
  db.get(verifyExamSql, [studentExamId, studentId], (err, studentExam) => {
    if (err) {
      return res.status(500).json({ message: 'Error verifying exam session.', error: err.message });
    }
    if (!studentExam) {
      return res.status(403).json({ message: 'Invalid exam session or exam already finished.' });
    }

    // Check if question is part of the exam this student_exam_id refers to
    const verifyQuestionInExamSql = `
        SELECT eq.question_id
        FROM exam_questions eq
        JOIN student_exams se ON eq.exam_id = se.exam_id
        WHERE se.id = ? AND eq.question_id = ?
    `;
    db.get(verifyQuestionInExamSql, [studentExamId, questionId], (err, examQuestion) => {
        if (err) {
            return res.status(500).json({ message: 'Error verifying question in exam.', error: err.message });
        }
        if (!examQuestion) {
            return res.status(403).json({ message: 'Question is not part of this exam.' });
        }

        // Upsert: Insert or replace the answer
        const answerSql = `
          INSERT INTO student_answers (student_exam_id, question_id, answer_text)
          VALUES (?, ?, ?)
          ON CONFLICT(student_exam_id, question_id)
          DO UPDATE SET answer_text = excluded.answer_text, is_correct = NULL; -- Reset is_correct on new answer
        `;
        // Storing answer_text as is (could be string or stringified JSON from client)
        db.run(answerSql, [studentExamId, questionId, answer_text], function(err) {
          if (err) {
            console.error(err.message);
            return res.status(500).json({ message: 'Error submitting answer.', error: err.message });
          }
          res.status(201).json({ message: 'Answer submitted successfully.' });
        });
    });
  });
});

// POST /api/student/exams/:studentExamId/finish - Finish an exam and calculate score
router.post('/exams/:studentExamId/finish', authenticateToken, (req, res) => {
  const { studentExamId } = req.params;
  const studentId = req.user.userId;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION;');

    // Verify student_exam, mark end_time
    const finishExamSql = `UPDATE student_exams SET end_time = CURRENT_TIMESTAMP WHERE id = ? AND student_id = ? AND end_time IS NULL`;
    db.run(finishExamSql, [studentExamId, studentId], function(err) {
      if (err) {
        db.run('ROLLBACK;');
        return res.status(500).json({ message: 'Error finishing exam.', error: err.message });
      }
      if (this.changes === 0) {
        db.run('ROLLBACK;');
        return res.status(403).json({ message: 'Exam not found, not owned by user, or already finished.' });
      }

      // Get all student answers for this exam and the correct answers
      const answersSql = `
        SELECT sa.question_id, sa.answer_text, q.correct_answer, q.type as question_type
        FROM student_answers sa
        JOIN questions q ON sa.question_id = q.id
        WHERE sa.student_exam_id = ?
      `;
      db.all(answersSql, [studentExamId], (err, answers) => {
        if (err) {
          db.run('ROLLBACK;');
          return res.status(500).json({ message: 'Error fetching answers for scoring.', error: err.message });
        }

        let correctCount = 0;
        let updatePromises = [];

        answers.forEach(ans => {
          let isCorrect = false;
          // For multiple choice, assume correct_answer is a stringified array of correct option(s)
          // and answer_text is also a stringified array of chosen option(s)
          // For single_answer, it's a direct string comparison (case-insensitive for flexibility)
          if (ans.question_type === 'single_answer') {
             isCorrect = ans.answer_text != null && ans.correct_answer != null &&
                         ans.answer_text.toLowerCase() === ans.correct_answer.toLowerCase();
          } else if (ans.question_type === 'multiple_choice') {
             // This requires a consistent format for options and answers.
             // Assuming correct_answer is a string, and student's answer_text is also a string for MCQs for simplicity.
             // E.g. if options are "A", "B", "C", "D", correct_answer is "A", student_answer is "A".
             // If multiple selections are allowed and stored as JSON string array:
             // try {
             //   const studentChoices = JSON.parse(ans.answer_text);
             //   const correctChoices = JSON.parse(ans.correct_answer);
             //   isCorrect = Array.isArray(studentChoices) && Array.isArray(correctChoices) &&
             //               studentChoices.length === correctChoices.length &&
             //               studentChoices.every(choice => correctChoices.includes(choice));
             // } catch (e) { isCorrect = false; }
             // For simplicity here, let's assume single string correct answer for MCQ too, like "Option A"
             isCorrect = ans.answer_text === ans.correct_answer;
          }


          if (isCorrect) {
            correctCount++;
          }

          const p = new Promise((resolve, reject) => {
            db.run(`UPDATE student_answers SET is_correct = ? WHERE student_exam_id = ? AND question_id = ?`,
                   [isCorrect, studentExamId, ans.question_id],
                   (err) => {
                     if (err) reject(err); else resolve();
                   });
          });
          updatePromises.push(p);
        });

        Promise.all(updatePromises)
          .then(() => {
            const score = correctCount; // Or calculate percentage if needed
            db.run(`UPDATE student_exams SET score = ? WHERE id = ?`, [score, studentExamId], (err) => {
              if (err) {
                db.run('ROLLBACK;');
                return res.status(500).json({ message: 'Error saving final score.', error: err.message });
              }
              db.run('COMMIT;');
              res.json({ message: 'Exam finished and scored successfully.', score: score, totalQuestions: answers.length });
            });
          })
          .catch(err => {
            db.run('ROLLBACK;');
            res.status(500).json({ message: 'Error updating answer correctness.', error: err.message });
          });
      });
    });
  });
});

module.exports = router;
