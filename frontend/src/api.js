import axios from 'axios'

// На Railway VITE_API_URL задаётся как переменная окружения в настройках сервиса
// Локально продолжает работать на localhost:8000
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api = axios.create({ baseURL: BASE_URL })

const token = localStorage.getItem('token')
if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`

export default api
