const express = require('express');
const db = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/exams - Create a new exam (Admin only)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  const { title, description, time_per_question, question_limit, questions } = req.body;

  if (!title || !time_per_question || !question_limit || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ message: 'Missing required fields: title, time_per_question, question_limit, and questions array.' });
  }

  if (question_limit <= 0 || question_limit > 25) {
    return res.status(400).json({ message: 'Question limit must be between 1 and 25.' });
  }

  // Ensure questions have id and order, and order is unique and sequential starting from 1
  let expectedOrder = 1;
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);

  if (sortedQuestions.length === 0 || sortedQuestions.length > question_limit) {
    return res.status(400).json({ message: `Number of questions provided (${sortedQuestions.length}) must be between 1 and the question_limit (${question_limit}).`});
  }

  for (const q of sortedQuestions) {
    if (!q.id || q.order == null) {
      return res.status(400).json({ message: 'Each question in the questions array must have an "id" and "order".' });
    }
    if (q.order !== expectedOrder) {
      return res.status(400).json({ message: `Question order must be sequential and start from 1. Expected order ${expectedOrder}, got ${q.order}.` });
    }
    expectedOrder++;
  }

  const examSql = `INSERT INTO exams (title, description, time_per_question, question_limit) VALUES (?, ?, ?, ?)`;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION;', (err) => {
      if (err) {
        console.error('Transaction Begin Error:', err.message);
        return res.status(500).json({ message: 'Error starting transaction.', error: err.message });
      }
    });

    db.run(examSql, [title, description, time_per_question, question_limit], function(err) {
      if (err) {
        db.run('ROLLBACK;');
        console.error('Exam Insert Error:',err.message);
        return res.status(500).json({ message: 'Error creating exam.', error: err.message });
      }
      const examId = this.lastID;
      const examQuestionSql = `INSERT INTO exam_questions (exam_id, question_id, question_order) VALUES (?, ?, ?)`;

      let operationsCompleted = 0;
      let errorOccurred = false;

      questions.forEach(q => {
        db.run(examQuestionSql, [examId, q.id, q.order], function(err) {
          if (errorOccurred) return; // Stop processing if an error has already occurred
          if (err) {
            errorOccurred = true;
            db.run('ROLLBACK;', rollbackErr => {
              if(rollbackErr) console.error('Rollback Error:', rollbackErr.message);
            });
            console.error(`Error adding question ${q.id} to exam ${examId}:`, err.message);
            if (!res.headersSent) {
                res.status(500).json({ message: `Error adding question ${q.id} to exam.`, error: err.message });
            }
            return;
          }
          operationsCompleted++;
          if (operationsCompleted === questions.length) {
            db.run('COMMIT;', (commitErr) => {
                if (commitErr) {
                    db.run('ROLLBACK;', rollbackErr => {
                       if(rollbackErr) console.error('Commit Rollback Error:', rollbackErr.message);
                    });
                    console.error('Commit Error:', commitErr.message);
                    if (!res.headersSent) {
                       res.status(500).json({ message: 'Error committing transaction.', error: commitErr.message });
                    }
                } else {
                   if (!res.headersSent) {
                       res.status(201).json({ message: 'Exam created successfully.', examId: examId });
                   }
                }
            });
          }
        });
      });
    });
  });
});

// GET /api/exams - Get all exams (Admin only)
router.get('/', authenticateToken, isAdmin, (req, res) => {
  const sql = `
    SELECT e.id, e.title, e.description, e.time_per_question, e.question_limit, COUNT(eq.id) as actual_question_count
    FROM exams e
    LEFT JOIN exam_questions eq ON e.id = eq.exam_id
    GROUP BY e.id, e.title, e.description, e.time_per_question, e.question_limit
    ORDER BY e.id DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: 'Error fetching exams.' });
    }
    res.json(rows);
  });
});

// GET /api/exams/:id - Get a single exam by ID with questions (Admin only)
router.get('/:id', authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const examSql = `SELECT * FROM exams WHERE id = ?`;
  db.get(examSql, [id], (err, exam) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: 'Error fetching exam details.' });
    }
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found.' });
    }

    const questionsSql = `
      SELECT q.id, q.text, q.type, q.options, q.correct_answer, eq.question_order
      FROM questions q
      JOIN exam_questions eq ON q.id = eq.question_id
      WHERE eq.exam_id = ?
      ORDER BY eq.question_order ASC
    `;
    db.all(questionsSql, [id], (err, questions) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ message: 'Error fetching questions for the exam.' });
      }
      // Parse options for multiple_choice questions
      const parsedQuestions = questions.map(q => {
        if (q.type === 'multiple_choice' && q.options) {
          try {
            q.options = JSON.parse(q.options);
          } catch (e) {
            console.error("Error parsing options JSON for question ID " + q.id, e);
          }
        }
        return q;
      });
      res.json({ ...exam, questions: parsedQuestions });
    });
  });
});

// PUT /api/exams/:id - Update an exam by ID (Admin only)
router.put('/:id', authenticateToken, isAdmin, (req, res) => {
  const { id: examId } = req.params;
  const { title, description, time_per_question, question_limit, questions } = req.body;

  if (!title || !time_per_question || !question_limit || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ message: 'Missing required fields: title, time_per_question, question_limit, and questions array.' });
  }
  if (question_limit <= 0 || question_limit > 25) {
    return res.status(400).json({ message: 'Question limit must be between 1 and 25.' });
  }

  let expectedOrder = 1;
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);

  if (sortedQuestions.length === 0 || sortedQuestions.length > question_limit) {
    // This condition is only problematic if sortedQuestions.length is NOT 0.
    // If sortedQuestions.length IS 0, it means we are removing all questions, which is allowed.
    // The check "sortedQuestions.length > question_limit" handles cases where too many questions are provided.
    // The check "sortedQuestions.length === 0" is fine if that's the intent.
    // The prompt implies `questions` array can be empty to remove all questions.
    // So, this condition should be: if (sortedQuestions.length > question_limit)
    // However, the original prompt had "sortedQuestions.length === 0 || sortedQuestions.length > question_limit"
    // For now, I'll stick to the provided logic, but note this potential ambiguity.
    // If an exam must have at least one question, this check is fine. If it can have zero, it needs adjustment.
    // The schema for exam_questions does not enforce that an exam must have questions.
    // The prompt for POST also says "questions.length === 0" is an error. So keeping it consistent.
     return res.status(400).json({ message: `Number of questions provided (${sortedQuestions.length}) must be between 1 and the question_limit (${question_limit}).`});
  }


  for (const q of sortedQuestions) {
    if (!q.id || q.order == null) {
      return res.status(400).json({ message: 'Each question in the questions array must have an "id" and "order".' });
    }
    if (q.order !== expectedOrder) {
      return res.status(400).json({ message: `Question order must be sequential and start from 1. Expected order ${expectedOrder}, got ${q.order}.` });
    }
    expectedOrder++;
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION;', (err) => {
        if (err) return res.status(500).json({ message: 'Error starting transaction for update.', error: err.message });
    });

    const updateExamSql = `UPDATE exams SET title = ?, description = ?, time_per_question = ?, question_limit = ? WHERE id = ?`;
    db.run(updateExamSql, [title, description, time_per_question, question_limit, examId], function(err) {
      if (err) {
        db.run('ROLLBACK;');
        return res.status(500).json({ message: 'Error updating exam details.', error: err.message });
      }
      if (this.changes === 0) {
        db.run('ROLLBACK;');
        return res.status(404).json({ message: 'Exam not found for update.' });
      }

      // Delete old exam_questions entries for this exam
      const deleteOldQuestionsSql = `DELETE FROM exam_questions WHERE exam_id = ?`;
      db.run(deleteOldQuestionsSql, [examId], (err) => {
        if (err) {
          db.run('ROLLBACK;');
          return res.status(500).json({ message: 'Error clearing old questions for update.', error: err.message });
        }

        // Insert new exam_questions entries
        const insertNewQuestionSql = `INSERT INTO exam_questions (exam_id, question_id, question_order) VALUES (?, ?, ?)`;
        let operationsCompleted = 0;
        let errorOccurred = false;

        if (questions.length === 0) { // Handle case where all questions are removed
            db.run('COMMIT;', (commitErr) => {
                if (commitErr) {
                    db.run('ROLLBACK;');
                    return res.status(500).json({ message: 'Error committing transaction after removing questions.', error: commitErr.message });
                }
                // Check headersSent before sending response
                if (!res.headersSent) {
                    res.json({ message: 'Exam updated successfully, all questions removed.' });
                }
            });
            return;
        }

        questions.forEach(q => {
          db.run(insertNewQuestionSql, [examId, q.id, q.order], function(err) {
            if (errorOccurred) return;
            if (err) {
              errorOccurred = true;
              db.run('ROLLBACK;');
              if (!res.headersSent) {
                res.status(500).json({ message: `Error associating question ${q.id} with exam during update.`, error: err.message });
              }
              return;
            }
            operationsCompleted++;
            if (operationsCompleted === questions.length) {
              db.run('COMMIT;', (commitErr) => {
                if (commitErr) {
                  db.run('ROLLBACK;');
                  if (!res.headersSent) {
                    res.status(500).json({ message: 'Error committing transaction during update.', error: commitErr.message });
                  }
                } else {
                  if (!res.headersSent) {
                    res.json({ message: 'Exam updated successfully.' });
                  }
                }
              });
            }
          });
        });
      });
    });
  });
});

// DELETE /api/exams/:id - Delete an exam by ID (Admin only)
router.delete('/:id', authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;
  // The exam_questions entries will be deleted automatically due to ON DELETE CASCADE
  const sql = `DELETE FROM exams WHERE id = ?`;
  db.run(sql, [id], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: 'Error deleting exam.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Exam not found.' });
    }
    res.json({ message: 'Exam deleted successfully.' });
  });
});

module.exports = router;
