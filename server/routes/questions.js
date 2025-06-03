const express = require('express');
const db = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/questions - Create a new question (Admin only)
router.post('/', authenticateToken, isAdmin, (req, res) => {
  const { text, type, options, correct_answer } = req.body;

  if (!text || !type || !correct_answer) {
    return res.status(400).json({ message: 'Missing required fields: text, type, correct_answer.' });
  }

  if (!['multiple_choice', 'single_answer'].includes(type)) {
    return res.status(400).json({ message: "Type must be 'multiple_choice' or 'single_answer'." });
  }

  if (type === 'multiple_choice' && (!options || typeof options !== 'object')) {
    return res.status(400).json({ message: "Options field (array of strings) is required for multiple_choice questions." });
  }

  const optionsString = (type === 'multiple_choice') ? JSON.stringify(options) : null;

  const sql = `INSERT INTO questions (text, type, options, correct_answer) VALUES (?, ?, ?, ?)`;
  db.run(sql, [text, type, optionsString, correct_answer], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: 'Error creating question.' });
    }
    res.status(201).json({ message: 'Question created successfully.', questionId: this.lastID });
  });
});

// GET /api/questions - Get all questions (Admin only)
router.get('/', authenticateToken, isAdmin, (req, res) => {
  const sql = `SELECT * FROM questions`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: 'Error fetching questions.' });
    }
    const questions = rows.map(q => {
      if (q.type === 'multiple_choice' && q.options) {
        try {
          q.options = JSON.parse(q.options);
        } catch (e) {
          console.error("Error parsing options JSON for question ID " + q.id, e);
        }
      }
      return q;
    });
    res.json(questions);
  });
});

// GET /api/questions/:id - Get a single question by ID (Admin only)
router.get('/:id', authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const sql = `SELECT * FROM questions WHERE id = ?`;
  db.get(sql, [id], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: 'Error fetching question.' });
    }
    if (!row) {
      return res.status(404).json({ message: 'Question not found.' });
    }
    if (row.type === 'multiple_choice' && row.options) {
      try {
        row.options = JSON.parse(row.options);
      } catch (e) {
        console.error("Error parsing options JSON for question ID " + row.id, e);
      }
    }
    res.json(row);
  });
});

// PUT /api/questions/:id - Update a question by ID (Admin only)
router.put('/:id', authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const { text, type, options, correct_answer } = req.body;

  if (!text || !type || !correct_answer) {
    return res.status(400).json({ message: 'Missing required fields: text, type, correct_answer.' });
  }

  if (!['multiple_choice', 'single_answer'].includes(type)) {
    return res.status(400).json({ message: "Type must be 'multiple_choice' or 'single_answer'." });
  }

  if (type === 'multiple_choice' && (!options || typeof options !== 'object')) {
    return res.status(400).json({ message: "Options field (array of strings) is required for multiple_choice questions." });
  }

  const optionsString = (type === 'multiple_choice') ? JSON.stringify(options) : null;

  const sql = `UPDATE questions SET text = ?, type = ?, options = ?, correct_answer = ? WHERE id = ?`;
  db.run(sql, [text, type, optionsString, correct_answer, id], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: 'Error updating question.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Question not found or no changes made.' });
    }
    res.json({ message: 'Question updated successfully.' });
  });
});

// DELETE /api/questions/:id - Delete a question by ID (Admin only)
router.delete('/:id', authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const sql = `DELETE FROM questions WHERE id = ?`;
  db.run(sql, [id], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: 'Error deleting question.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Question not found.' });
    }
    res.json({ message: 'Question deleted successfully.' });
  });
});

module.exports = router;
