// register.js
// Register page logic.

redirectIfLoggedIn();

const daySelect = document.getElementById('birthDay');
const yearSelect = document.getElementById('birthYear');

for (let d = 1; d <= 31; d++) {
  const o = document.createElement('option');
  o.value = d;
  o.textContent = d;
  if (d === 9) o.selected = true;
  daySelect.appendChild(o);
}

const cy = new Date().getFullYear();
for (let y = cy; y >= 1950; y--) {
  const o = document.createElement('option');
  o.value = y;
  o.textContent = y;
  if (y === 2021) o.selected = true;
  yearSelect.appendChild(o);
}

document.getElementById('signupForm').addEventListener('submit', function(e) {
  e.preventDefault();

  const users = getUsers();
  const email = document.getElementById('signupEmail').value.trim().toLowerCase();
  const password = document.getElementById('signupPassword').value;

  if (users.some(u => u.email === email)) {
    document.getElementById('signupMessage').textContent = 'This email is already registered.';
    return;
  }

  const g = document.querySelector('input[name="gender"]:checked');
  const newUser = {
    firstName: document.getElementById('firstName').value.trim(),
    lastName: document.getElementById('lastName').value.trim(),
    email,
    password,
    birthday: `${document.getElementById('birthDay').value} ${document.getElementById('birthMonth').value} ${document.getElementById('birthYear').value}`,
    gender: g ? g.value : ''
  };

  users.push(newUser);
  saveUsers(users);
  setCurrentUser(newUser);
  window.location.href = 'app.html#/dashboard';
});
