import React, { useState, useEffect } from 'react';
import { fetchExams, deleteExam, createExam, updateExam } from '../../services/api';
import ExamForm from './ExamForm';

const ExamList = () => {
  const [exams, setExams] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingExamId, setEditingExamId] = useState(null); // null for new, ID for edit

  const loadExams = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchExams();
      setExams(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch exams.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Mock token for dev - REMOVE IN PRODUCTION
    if (!localStorage.getItem('token')) {
        localStorage.setItem('token', 'dummy-admin-token-for-dev-exams');
    }
    loadExams();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this exam? This may affect student records if not handled carefully by the backend.')) {
      try {
        await deleteExam(id);
        loadExams(); // Refresh list
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete exam.');
        console.error(err);
      }
    }
  };

  const handleOpenForm = (examId = null) => {
    setEditingExamId(examId);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingExamId(null);
    setError(null); // Clear previous form errors
  };

  const handleFormSubmit = async (examData) => {
    setIsLoading(true);
    setError(null);
    try {
      if (editingExamId) {
        await updateExam(editingExamId, examData);
      } else {
        await createExam(examData);
      }
      loadExams(); // Refresh list
      handleCloseForm();
    } catch (err) {
      console.error(err.response || err);
      setError(err.response?.data?.message || (editingExamId ? 'Failed to update exam.' : 'Failed to create exam.'));
      // Keep form open on error, so user can see form errors or general errors
    } finally {
      setIsLoading(false); // Stop loading indicator
    }
  };

  if (isLoading && !exams.length && !error) return <p>Loading exams...</p>;

  return (
    <div>
      <h2>Exam Management</h2>
      {error && !showForm && <p style={{color: 'red'}}>Error: {error}</p>} {/* Display general errors when form is hidden */}
      <button onClick={() => handleOpenForm(null)}>Create New Exam</button>

      {showForm && (
        <ExamForm
          examToEditId={editingExamId}
          onFormSubmit={handleFormSubmit}
          onCancel={handleCloseForm}
        />
      )}
      {/* Display form-specific errors inside ExamForm, general errors here if form is closed */}


      {!exams.length && !isLoading && !showForm && !error && <p>No exams found. Create one!</p>}

      <ul style={{ listStyleType: 'none', padding: 0 }}>
        {exams.map(ex => (
          <li key={ex.id} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
            <strong>Title:</strong> {ex.title} <br />
            <strong>Description:</strong> {ex.description || 'N/A'} <br />
            <strong>Time/Question:</strong> {ex.time_per_question}s <br />
            <strong>Question Limit:</strong> {ex.question_limit} <br />
            <strong>Actual Questions:</strong> {ex.actual_question_count !== undefined ? ex.actual_question_count : 'N/A'} <br />
            <button onClick={() => handleOpenForm(ex.id)}>Edit</button>
            <button onClick={() => handleDelete(ex.id)} style={{marginLeft: '5px'}}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ExamList;
