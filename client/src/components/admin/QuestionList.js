import React, { useState, useEffect } from 'react';
import { fetchQuestions, deleteQuestion, createQuestion, updateQuestion } from '../../services/api';
import QuestionForm from './QuestionForm'; // Import the form

const QuestionList = () => {
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null); // null for new, object for edit

  const loadQuestions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchQuestions();
      setQuestions(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch questions.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Mock a token for development if not present - REMOVE THIS IN PRODUCTION / WITH REAL AUTH
    if (!localStorage.getItem('token')) {
        localStorage.setItem('token', 'dummy-admin-token-for-dev');
        // Ensure your backend /api/questions route is accessible with this dummy token or temporarily remove auth for dev
    }
    loadQuestions();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await deleteQuestion(id);
        loadQuestions(); // Refresh list
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete question.');
        console.error(err);
      }
    }
  };

  const handleOpenForm = (question = null) => {
    setEditingQuestion(question); // If question is null, it's a new question
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingQuestion(null);
  };

  const handleFormSubmit = async (questionData) => {
    setIsLoading(true);
    try {
      if (editingQuestion && editingQuestion.id) {
        await updateQuestion(editingQuestion.id, questionData);
      } else {
        await createQuestion(questionData);
      }
      loadQuestions(); // Refresh list
      handleCloseForm();
    } catch (err) {
      setError(err.response?.data?.message || (editingQuestion ? 'Failed to update question.' : 'Failed to create question.'));
      console.error(err);
      // Keep form open on error so user can see and correct
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !questions.length && !error) return <p>Loading questions...</p>;
  // if (error) return <p style={{color: 'red'}}>{error}</p>; // Show error more prominently if needed

  return (
    <div>
      <h2>Question Management</h2>
      {error && <p style={{color: 'red'}}>Error: {error}</p>}
      <button onClick={() => handleOpenForm(null)}>Add New Question</button>

      {showForm && (
        <div style={{ border: '1px solid #eee', padding: '10px', margin: '10px 0' }}>
          <QuestionForm
            questionToEdit={editingQuestion}
            onFormSubmit={handleFormSubmit}
          />
          <button onClick={handleCloseForm} style={{marginTop: '10px'}}>Cancel</button>
        </div>
      )}

      {!questions.length && !isLoading && !showForm && !error && <p>No questions found. Add some!</p>}

      <ul style={{ listStyleType: 'none', padding: 0 }}>
        {questions.map(q => (
          <li key={q.id} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
            <strong>Text:</strong> {q.text} <br />
            <strong>Type:</strong> {q.type} <br />
            {q.type === 'multiple_choice' && q.options && (
              <span><strong>Options:</strong> {Array.isArray(q.options) ? q.options.join(', ') : String(q.options)} <br /></span>
            )}
            <strong>Correct Answer:</strong> {q.correct_answer} <br />
            <button onClick={() => handleOpenForm(q)}>Edit</button>
            <button onClick={() => handleDelete(q.id)} style={{marginLeft: '5px'}}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default QuestionList;
