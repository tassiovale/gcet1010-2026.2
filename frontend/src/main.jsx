import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../style.css';

async function readApiResponse(response) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`A API retornou uma resposta inválida (HTTP ${response.status}). Confira os logs da função na Vercel.`);
  }
  if (!response.ok) throw new Error(data.message || `Erro da API (HTTP ${response.status}).`);
  return data;
}

function AuthCard({ registering }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requirements = [
    [password.length >= 8, 'Pelo menos 8 caracteres'],
    [/[a-z]/.test(password) && /[A-Z]/.test(password), 'Letra maiúscula e minúscula'],
    [/\d/.test(password), 'Pelo menos um número'],
    [/[@$!%*?&._-]/.test(password), 'Pelo menos um símbolo (!@#$...)'],
  ];

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (registering && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&._-]).{8,}$/.test(password)) {
      setError('A senha deve cumprir todos os requisitos de segurança indicados.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(registering ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registering ? { name, email, password } : { email, password }),
      });
      const data = await readApiResponse(response);

      if (registering) {
        setSuccess('Conta criada com sucesso! Redirecionando...');
        window.setTimeout(() => { window.location.href = 'index.html'; }, 2000);
      } else {
        localStorage.setItem('questify_access_token', data.accessToken);
        localStorage.setItem('questify_refresh_token', data.refreshToken);
        window.location.href = 'dashboard.html';
      }
    } catch (submitError) {
      setError(submitError.message || 'Erro ao conectar com o servidor.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-container">
      <section className="auth-card" aria-labelledby="auth-title">
        <h2 id="auth-title">{registering ? 'Criar Conta' : 'Questify'}</h2>
        <p className="subtitle">
          {registering ? 'Junte-se ao Questify e comece sua jornada' : 'Faça login para continuar sua jornada'}
        </p>
        <form onSubmit={handleSubmit}>
          {registering && (
            <div className="input-group">
              <label htmlFor="name">Nome completo</label>
              <input id="name" type="text" required maxLength="120" placeholder="Seu nome" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
          )}
          <div className="input-group">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" required maxLength="254" placeholder="seu.email@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="input-group">
            <label htmlFor="password">{registering ? 'Senha forte' : 'Senha'}</label>
            <input id="password" type="password" required maxLength="256" placeholder={registering ? 'Digite sua senha' : '********'} value={password} onChange={(event) => setPassword(event.target.value)} />
            {registering && (
              <ul className="password-requirements" aria-label="Requisitos da senha">
                {requirements.map(([valid, label]) => <li key={label} className={valid ? 'valid' : ''}>{valid ? '✔️' : '❌'} {label}</li>)}
              </ul>
            )}
          </div>
          {error && <div className="error-message" role="alert">{error}</div>}
          {success && <div className="success-message" role="status">{success}</div>}
          <button className="btn-primary" type="submit" disabled={submitting}>{submitting ? 'Aguarde...' : registering ? 'Cadastrar' : 'Entrar'}</button>
        </form>
        <p className="footer-link">
          {registering ? 'Já tem uma conta? ' : 'Ainda não tem uma conta? '}
          <a href={registering ? 'index.html' : 'register.html'}>{registering ? 'Faça login' : 'Cadastre-se'}</a>
        </p>
      </section>
    </main>
  );
}

const registering = window.location.pathname.endsWith('/register.html') || window.location.pathname.endsWith('/register');
createRoot(document.getElementById('root')).render(<React.StrictMode><AuthCard registering={registering} /></React.StrictMode>);
