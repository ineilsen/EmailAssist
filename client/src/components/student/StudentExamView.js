import React, { useState, useEffect, useCallback, useRef } from 'react';
import { startExam, submitAnswer, finishExam, fetchExams } from '../../services/api'; // Assuming fetchExams lists available exams
import QuestionDisplay from './QuestionDisplay';

const StudentExamView = () => {
  const [availableExams, setAvailableExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');

  const [studentExamId, setStudentExamId] = useState(null);
  const [examQuestions, setExamQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0); // For the current question
  const [examFinished, setExamFinished] = useState(false);
  const [score, setScore] = useState(null);
  const [totalAnsweredInSession, setTotalAnsweredInSession] = useState(0); // Tracks answers submitted in current session

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const timePerQuestionRef = useRef(0); // Using ref to hold timePerQuestion from exam details

  // Fetch available exams
  useEffect(() => {
    const loadExams = async () => {
      setIsLoading(true);
      try {
        // Ensure dummy token for dev if not present - REMOVE FOR PROD
        if (!localStorage.getItem('token')) {
            // Use a different token or ensure the student role can access this if using the same admin token
            localStorage.setItem('token', 'dummy-student-token-for-dev-examview');
        }
        const response = await fetchExams();
        setAvailableExams(response.data || []);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch available exams", err);
        setError(err.response?.data?.message || "Failed to load exams. Ensure you are logged in or try again.");
      } finally {
        setIsLoading(false);
      }
    };
    loadExams();
  }, []);

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < examQuestions.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
      setTimeLeft(timePerQuestionRef.current);
    } else {
      // Last question answered or skipped, attempt to finish exam
      handleFinishExam();
    }
  }, [currentQuestionIndex, examQuestions.length]); // Added handleFinishExam to dependencies

  // Timer logic
  useEffect(() => {
    if (!studentExamId || examFinished || timeLeft <= 0 || currentQuestionIndex >= examQuestions.length) {
      if (timeLeft <= 0 && studentExamId && !examFinished && currentQuestionIndex < examQuestions.length) {
         console.log("Time ran out for question", examQuestions[currentQuestionIndex]?.id);
         // Auto-submit a "Time Ran Out" or empty answer, then move to next.
         // For simplicity, we'll just move to the next question.
         // A more robust solution might call submitAnswer with a special value.
         handleNextQuestion();
      }
      return;
    }
    const timerId = setInterval(() => setTimeLeft(prevTime => prevTime - 1), 1000);
    return () => clearInterval(timerId);
  }, [studentExamId, examFinished, timeLeft, currentQuestionIndex, examQuestions, handleNextQuestion]);


  const handleStartExam = async () => {
    if (!selectedExamId) {
      setError("Please select an exam to start.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await startExam(selectedExamId);
      setStudentExamId(response.data.studentExamId);
      setExamQuestions(response.data.questions || []);
      timePerQuestionRef.current = response.data.timePerQuestion || 60;
      setCurrentQuestionIndex(0);
      setTimeLeft(timePerQuestionRef.current);
      setExamFinished(false);
      setScore(null);
      setTotalAnsweredInSession(0); // Reset for new exam session
    } catch (err) {
      console.error("Failed to start exam", err);
      setError(err.response?.data?.message || "Failed to start exam.");
      setStudentExamId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSubmit = async (questionId, answerText) => {
    if (!studentExamId) return;
    setIsLoading(true); // May want a more granular loading state for just answer submission
    try {
      await submitAnswer(studentExamId, questionId, { answer_text: answerText });
      setTotalAnsweredInSession(prev => prev + 1);
      // Move to next question or finish if it's the last one
      handleNextQuestion();
    } catch (err) {
      console.error("Failed to submit answer", err);
      setError(err.response?.data?.message || "Failed to submit answer.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishExam = async () => {
    if (!studentExamId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await finishExam(studentExamId);
      setScore(response.data.score);
      setExamFinished(true);
      // Keep studentExamId to show score related to this finished exam, but clear questions
      setExamQuestions([]);
      setCurrentQuestionIndex(0);
    } catch (err) {
      console.error("Failed to finish exam", err);
      setError(err.response?.data?.message || "Failed to finish exam.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !studentExamId && availableExams.length === 0 && !error) return <p>Loading available exams...</p>;


  if (!studentExamId && !examFinished) {
    return (
      <div>
        <h2>Available Exams</h2>
        {error && <p style={{color: 'red'}}>Error: {error}</p>}
        {availableExams.length === 0 && !isLoading && <p>No exams available at the moment.</p>}
        <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} disabled={isLoading} style={{padding:'8px', marginRight:'10px', minWidth:'200px'}}>
          <option value="">-- Select an Exam --</option>
          {availableExams.map(exam => (
            <option key={exam.id} value={exam.id}>{exam.title} ({exam.actual_question_count || exam.question_limit || 'N/A'} Questions)</option>
          ))}
        </select>
        <button onClick={handleStartExam} disabled={isLoading || !selectedExamId} style={{padding:'8px 15px'}}>
          {isLoading ? 'Starting...' : 'Start Selected Exam'}
        </button>
      </div>
    );
  }

  if (examFinished) {
    return (
      <div>
        <h2>Exam Finished!</h2>
        {error && <p style={{color: 'red'}}>Error: {error}</p>}
        <p>Your score: {score !== null ? `${score} / ${totalAnsweredInSession}` : 'Being calculated...'}</p>
        <button onClick={() => {
            setExamFinished(false);
            setSelectedExamId('');
            setStudentExamId(null);
            setError(null);
            // Re-fetch available exams if needed, or assume list is current
            // loadExams(); // if list might change or needs refresh
            }} style={{padding:'8px 15px'}}>
            Take Another Exam
        </button>
      </div>
    );
  }

  const currentQuestion = examQuestions[currentQuestionIndex];

  return (
    <div>
      <h2>Exam In Progress...</h2>
      {error && <p style={{color: 'red'}}>Error: {error}</p>}
      {currentQuestion && (
        <>
          <p>Time Left for this question: <strong style={{fontSize:'1.2em'}}>{timeLeft}s</strong></p>
          <QuestionDisplay
            question={currentQuestion}
            onAnswerSubmit={handleAnswerSubmit}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={examQuestions.length}
          />
        </>
      )}
      {currentQuestionIndex >= examQuestions.length && !examFinished && !isLoading && (
        <p>All questions processed. Finalizing your results...</p>
      )}
       {isLoading && currentQuestion && <p>Submitting answer...</p>}
      <button onClick={handleFinishExam} disabled={isLoading} style={{marginTop:'20px', padding:'10px 20px', backgroundColor:'darkred', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>
        Finish Exam Now & See Score
      </button>
       <p><small>Questions answered in this attempt: {totalAnsweredInSession} / {examQuestions.length}</small></p>
    </div>
  );
};

export default StudentExamView;
