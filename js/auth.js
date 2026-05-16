// auth.js
// Shared localStorage authentication helpers.

function getUsers() {
  return JSON.parse(localStorage.getItem('users') || '[]');
}

function saveUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem('currentUser') || 'null');
}

function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

function logout() {
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
}

function requireLogin() {
  if (!getCurrentUser()) {
    window.location.href = 'index.html';
  }
}

function redirectIfLoggedIn() {
  if (getCurrentUser()) {
    window.location.href = 'app.html#/dashboard';
  }
}
