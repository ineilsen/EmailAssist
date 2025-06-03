import axios from 'axios';

const API_URL = '/api'; // Assuming client is served by the same server as API or proxy is set up

// Function to get the token, assuming it's stored in localStorage after login
const getToken = () => localStorage.getItem('token');

const axiosInstance = axios.create({
  baseURL: API_URL,
});

axiosInstance.interceptors.request.use(config => {
  const token = getToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, error => {
  return Promise.reject(error);
});

// Question Services
export const fetchQuestions = () => axiosInstance.get('/questions');
export const createQuestion = (questionData) => axiosInstance.post('/questions', questionData);
export const updateQuestion = (id, questionData) => axiosInstance.put(`/questions/${id}`, questionData);
export const deleteQuestion = (id) => axiosInstance.delete(`/questions/${id}`);
export const fetchQuestionById = (id) => axiosInstance.get(`/questions/${id}`);

// Auth Services (example, can be expanded)
export const login = (credentials) => axios.post(`${API_URL}/auth/login`, credentials);
export const register = (userData) => axios.post(`${API_URL}/auth/register`, userData);

// Exam Services
export const fetchExams = () => axiosInstance.get('/exams');
export const createExam = (examData) => axiosInstance.post('/exams', examData);
export const fetchExamById = (id) => axiosInstance.get(`/exams/${id}`);
export const updateExam = (id, examData) => axiosInstance.put(`/exams/${id}`, examData);
export const deleteExam = (id) => axiosInstance.delete(`/exams/${id}`);

// Student Exam Services
export const startExam = (examId) => axiosInstance.post(`/student/exams/${examId}/start`);
export const submitAnswer = (studentExamId, questionId, answerData) => axiosInstance.post(`/student/exams/${studentExamId}/questions/${questionId}/answer`, answerData);
export const finishExam = (studentExamId) => axiosInstance.post(`/student/exams/${studentExamId}/finish`);

export default axiosInstance;
