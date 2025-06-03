import React, { useState, useEffect } from 'react';
import { fetchQuestions, fetchExamById } from '../../services/api'; // fetchExamById for editing

const ExamForm = ({ examToEditId, onFormSubmit, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timePerQuestion, setTimePerQuestion] = useState(60); // Default 60s
  const [questionLimit, setQuestionLimit] = useState(10); // Default 10 questions

  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [selectedQuestions, setSelectedQuestions] = useState([]); // Array of { id, order, text (for display) }

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch available questions once on mount
  useEffect(() => {
    const loadAvailableQuestions = async () => {
      try {
        const response = await fetchQuestions();
        setAvailableQuestions(response.data || []);
      } catch (err) {
        console.error("Failed to fetch available questions", err);
        setError("Failed to load questions for selection.");
      }
    };
    loadAvailableQuestions();
  }, []);

  // Populate form if examToEditId is provided
  useEffect(() => {
    if (examToEditId) {
      setIsLoading(true);
      const loadExamData = async () => {
        try {
          const response = await fetchExamById(examToEditId);
          const exam = response.data;
          setTitle(exam.title || '');
          setDescription(exam.description || '');
          setTimePerQuestion(exam.time_per_question || 60);
          setQuestionLimit(exam.question_limit || 10);

          // Format selected questions for the state: { id, order, text }
          const formattedSelectedQuestions = exam.questions ? exam.questions.map(q => ({
            id: q.id, // This should be question.id from the backend 'questions' table
            order: q.question_order, // This is from exam_questions table
            text: q.text // Assuming text is available for display from the join
          })) : [];
          setSelectedQuestions(formattedSelectedQuestions);
          setError(null);
        } catch (err) {
          console.error("Failed to fetch exam data for editing", err);
          setError(`Failed to load exam data: ${err.response?.data?.message || err.message}`);
        } finally {
          setIsLoading(false);
        }
      };
      loadExamData();
    } else {
      // Reset form for new exam
      setTitle('');
      setDescription('');
      setTimePerQuestion(60);
      setQuestionLimit(10);
      setSelectedQuestions([]);
      setError(null);
    }
  }, [examToEditId]);

  const handleQuestionSelection = (questionId) => {
    const question = availableQuestions.find(q => q.id.toString() === questionId);
    if (!question) return;

    // Avoid adding duplicates
    if (selectedQuestions.find(sq => sq.id === question.id)) return;

    // Add question and assign a temporary order (actual order set on submit or by re-ordering UI)
    const newOrder = selectedQuestions.length + 1;
    setSelectedQuestions([...selectedQuestions, { ...question, id: question.id, order: newOrder }]);
  };

  const handleRemoveSelectedQuestion = (questionId) => {
    const updatedSelection = selectedQuestions.filter(q => q.id !== questionId);
    // Re-order remaining questions
    const reorderedSelection = updatedSelection.map((q, index) => ({ ...q, order: index + 1 }));
    setSelectedQuestions(reorderedSelection);
  };

  const handleOrderChange = (questionId, direction) => {
    const index = selectedQuestions.findIndex(q => q.id === questionId);
    if (index === -1) return;

    const newSelectedQuestions = [...selectedQuestions];
    const questionToMove = newSelectedQuestions[index];

    if (direction === 'up' && index > 0) {
      // Swap with previous
      newSelectedQuestions[index] = newSelectedQuestions[index-1];
      newSelectedQuestions[index-1] = questionToMove;
    } else if (direction === 'down' && index < newSelectedQuestions.length - 1) {
      // Swap with next
      newSelectedQuestions[index] = newSelectedQuestions[index+1];
      newSelectedQuestions[index+1] = questionToMove;
    } else {
      return; // Cannot move further
    }
    // Update orders
    const reordered = newSelectedQuestions.map((q, idx) => ({ ...q, order: idx + 1 }));
    setSelectedQuestions(reordered);
  };


  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedQuestions.length === 0) {
        alert("An exam must have at least one question.");
        return;
    }
    if (selectedQuestions.length > questionLimit) {
        alert(`You have selected ${selectedQuestions.length} questions, but the limit is set to ${questionLimit}. Please remove some questions or increase the limit.`);
        return;
    }

    // Ensure order is sequential and correct before submitting
    const finalQuestions = selectedQuestions.map((q, index) => ({ id: q.id, order: index + 1 }));

    const examData = {
      title,
      description,
      time_per_question: parseInt(timePerQuestion, 10),
      question_limit: parseInt(questionLimit, 10),
      questions: finalQuestions
    };
    onFormSubmit(examData);
  };

  if (isLoading && examToEditId) return <p>Loading exam data...</p>;
  // Error is displayed within the form structure

  return (
    <form onSubmit={handleSubmit} style={{border: '1px solid #eee', padding: '15px', margin: '15px 0'}}>
      <h3>{examToEditId ? 'Edit Exam' : 'Create New Exam'}</h3>
      {error && <p style={{color: 'red'}}>Error: {error}</p>} {/* Display general form error here */}
      <div>
        <label>Title:</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label>Description:</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label>Time Per Question (seconds):</label>
        <input type="number" value={timePerQuestion} min="10" onChange={(e) => setTimePerQuestion(e.target.value)} required />
      </div>
      <div>
        <label>Question Limit (max 25):</label>
        <input type="number" value={questionLimit} min="1" max="25" onChange={(e) => setQuestionLimit(e.target.value)} required />
      </div>

      <h4>Select Questions for Exam</h4>
      <div>
        <label>Available Questions:</label>
        <select onChange={(e) => handleQuestionSelection(e.target.value)} value="">
          <option value="" disabled>-- Add a question --</option>
          {availableQuestions.filter(aq => !selectedQuestions.some(sq => sq.id === aq.id)).map(q => (
            <option key={q.id} value={q.id}>{q.text.substring(0,50)}... (Type: {q.type})</option>
          ))}
        </select>
        {availableQuestions.length === 0 && !error && <p>No available questions. Create questions first.</p>}
      </div>

      <h5>Selected Questions (Order them):</h5>
      {selectedQuestions.length === 0 && <p>No questions selected yet.</p>}
      <ul style={{listStyle:'decimal', paddingLeft: '20px'}}>
        {selectedQuestions.map((q, index) => (
          <li key={q.id} style={{marginBottom:'5px', borderBottom: '1px dashed #eee', paddingBottom: '5px'}}>
            <span>{q.order}. {q.text ? q.text.substring(0,50) : 'Question text missing'}...</span>
            <button type="button" onClick={() => handleOrderChange(q.id, 'up')} disabled={index === 0} style={{marginLeft:'5px'}}>Up</button>
            <button type="button" onClick={() => handleOrderChange(q.id, 'down')} disabled={index === selectedQuestions.length - 1}>Down</button>
            <button type="button" onClick={() => handleRemoveSelectedQuestion(q.id)} style={{color:'red', marginLeft:'10px'}}>Remove</button>
          </li>
        ))}
      </ul>

      <button type="submit">{examToEditId ? 'Update Exam' : 'Create Exam'}</button>
      <button type="button" onClick={onCancel} style={{marginLeft:'10px'}}>Cancel</button>
    </form>
  );
};

export default ExamForm;
