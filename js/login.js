// login.js
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const errorElem = document.getElementById('loginError');
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const username = loginForm.username.value.trim();
    const password = loginForm.password.value;
    const role = authenticate(username, password);
    if (role) {
      setSessionUser(username, role);
      if (role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'cotizador.html';
      }
    } else {
      errorElem.textContent = 'Usuario o contraseña incorrectos';
    }
  });
});