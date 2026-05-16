// index.js
// Login page logic.

redirectIfLoggedIn();

document.getElementById('loginForm').addEventListener('submit', function(e) {
  e.preventDefault();

  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const user = getUsers().find(u => u.email === email && u.password === password);

  if (!user) {
    document.getElementById('loginMessage').textContent = 'Invalid email or password.';
    return;
  }

  setCurrentUser(user);
  window.location.href = 'app.html#/dashboard';
});
