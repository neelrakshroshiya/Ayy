(function(){
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));

  // ------- Helpers -------
  function showLoading(on=true){
    const m = qs('#loadingModal');
    if(!m) return;
    m.style.display = on ? 'flex' : 'none';
  }
  
  function toast(msg, type = 'info'){
    console.log('Toast:', msg);
    const c = qs('#toastContainer');
    if(!c) { 
      alert(msg); 
      return; 
    }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `
      <div>${msg}</div>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    c.appendChild(t);
    setTimeout(()=>t.remove(), 6000);
  }
  
  function appendMsg(containerSel, role, htmlOrText){
    const box = qs(containerSel);
    if(!box) return;
    
    // Remove empty state if it exists
    const emptyState = box.querySelector('.empty-state');
    if(emptyState) emptyState.remove();
    
    const el = document.createElement('div');
    el.className = `message ${role}`;
    
    if(typeof htmlOrText === 'string' && /<[^>]+>/.test(htmlOrText)){
      el.innerHTML = htmlOrText;
    } else {
      el.textContent = htmlOrText;
    }
    
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }

  // ------- Tabs -------
  const tabs = qsa('.tab-btn');
  const panels = {
    summarizer: qs('#summarizer'),
    quiz: qs('#quiz'),
    chat: qs('#chat')
  };

  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(btn => btn.classList.remove('active'));
    t.classList.add('active');
    Object.values(panels).forEach(p => p && p.classList.remove('active'));
    const target = panels[t.dataset.tab];
    if(target) target.classList.add('active');
  }));

  // ------- Theme Toggle -------
  const themeBtn = qs('#themeToggle');
  const themeIcon = qs('#themeIcon');
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if(themeIcon) themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    try { localStorage.setItem('theme', theme); } catch(e){}
  }
  if(themeBtn){
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }
  setTheme((()=>{ try{return localStorage.getItem('theme')||'light';}catch(e){return 'light';} })());

  // ------- Backend Communication -------
  const API_URL = '/api/groq';
  
  async function callBackend(action, payload){
    console.log('API Call:', { action, payload });
    
    try{
      const requestBody = { action, payload };
      console.log('Request body:', requestBody);
      
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('Response status:', res.status);
      
      const text = await res.text();
      console.log('Response text:', text.substring(0, 200) + '...');
      
      let data;
      try { 
        data = JSON.parse(text); 
      } catch (parseError) { 
        console.error('JSON parse error:', parseError);
        data = { 
          error: `Invalid response format: ${text.substring(0, 100)}...`,
          status: res.status 
        }; 
      }
      
      if(!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      
      return data;
    } catch(err) {
      console.error('Backend call failed:', err);
      
      // Check if we're in development vs production
      const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      const hint = isDev 
        ? 'Make sure server is running and GEMINI_API_KEY is set'
        : 'Backend error occurred. Check your deployment settings.';
      
      return { error: `${err.message}. ${hint}` };
    }
  }

  // Test API connection on load
  (async () => {
    try {
      const response = await fetch('/api/test');
      const data = await response.json();
      console.log('API Test Result:', data);
      if (!data.gemini_key_present) {
        toast('Warning: Gemini API key not configured', 'warning');
      }
    } catch (error) {
      console.error('API test failed:', error);
      toast('API connection test failed', 'error');
    }
  })();

  // ------- Summarizer -------
  const summarizeBtn = qs('#summarizeBtn');
  if(summarizeBtn){
    summarizeBtn.addEventListener('click', async () => {
      const text = (qs('#summarizerInput')?.value || '').trim();
      if(!text) { 
        toast('Please enter text to summarize.', 'warning'); 
        return; 
      }
      
      if(text.length < 50) {
        toast('Please enter more text (at least 50 characters) for a meaningful summary.', 'warning');
        return;
      }
      
      showLoading(true);
      summarizeBtn.disabled = true;
      summarizeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Summarizing...';
      
      try {
        const resp = await callBackend('summarize', { text });
        
        if(resp.error) { 
          toast('Summarization error: ' + resp.error, 'error'); 
          return; 
        }
        
        const summary = resp.result || resp.reply || JSON.stringify(resp);
        appendMsg('#summarizerHistory', 'ai', summary);
        
        // Clear input after successful summary
        qs('#summarizerInput').value = '';
        toast('Summary generated successfully!', 'success');
        
      } catch (error) {
        console.error('Summarize error:', error);
        toast('Failed to generate summary: ' + error.message, 'error');
      } finally {
        showLoading(false);
        summarizeBtn.disabled = false;
        summarizeBtn.innerHTML = '<i class="fas fa-magic"></i> Summarize Text';
      }
    });
  }

  // ------- Quiz -------
  const quizBtn = qs('#generateQuizBtn');
  if(quizBtn){
    quizBtn.addEventListener('click', async () => {
      const topic = (qs('#quizInput')?.value || '').trim();
      if(!topic) { 
        toast('Please enter a topic for the quiz.', 'warning'); 
        return; 
      }
      
      showLoading(true);
      quizBtn.disabled = true;
      quizBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Quiz...';
      
      try {
        const resp = await callBackend('quiz', { text: topic, count: 5 });
        
        if(resp.error) { 
          toast('Quiz generation error: ' + resp.error, 'error'); 
          return; 
        }
        
        // Handle different response formats
        const questions = resp.questions || resp.quiz || resp.data || [];
        
        if(Array.isArray(questions) && questions.length > 0){
          const html = '<div class="quiz-container"><h4>Quiz: ' + topic + '</h4><ol class="quiz-list">' + 
            questions.map((q, index) => {
              if(typeof q === 'string') {
                return `<li class="quiz-item"><div class="question">${q}</div></li>`;
              }
              
              const questionText = q.question || q.q || `Question ${index + 1}`;
              const options = Array.isArray(q.options || q.choices) 
                ? '<ul class="quiz-options">' + (q.options || q.choices).map(o => `<li>${o}</li>`).join('') + '</ul>' 
                : '';
              const answer = q.answer 
                ? `<div class="quiz-answer"><strong>Answer:</strong> ${q.answer}</div>` 
                : '';
              
              return `
                <li class="quiz-item">
                  <div class="question">${questionText}</div>
                  ${options}
                  ${answer}
                </li>
              `;
            }).join('') + '</ol></div>';
            
          appendMsg('#quizHistory', 'ai', html);
        } else {
          // Fallback to raw response
          const fallback = resp.raw || resp.reply || JSON.stringify(resp);
          appendMsg('#quizHistory', 'ai', fallback);
        }
        
        // Clear input after successful quiz
        qs('#quizInput').value = '';
        toast('Quiz generated successfully!', 'success');
        
      } catch (error) {
        console.error('Quiz error:', error);
        toast('Failed to generate quiz: ' + error.message, 'error');
      } finally {
        showLoading(false);
        quizBtn.disabled = false;
        quizBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Generate Quiz';
      }
    });
  }

  // ------- Chat -------
  const sendBtn = qs('#sendChatBtn');
  const chatInput = qs('#chatInput');
  
  async function sendChatMessage() {
    const msg = (chatInput?.value || '').trim();
    if(!msg) return;
    
    appendMsg('#chatHistory', 'user', msg);
    chatInput.value = '';
    
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
      const resp = await callBackend('chat', { text: msg });
      
      const reply = resp.reply || resp.result || resp.message || 
                   (resp.error ? ('Error: ' + resp.error) : JSON.stringify(resp));
      
      appendMsg('#chatHistory', 'ai', reply);
      
    } catch (error) {
      console.error('Chat error:', error);
      appendMsg('#chatHistory', 'ai', 'Sorry, I encountered an error: ' + error.message);
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
  }
  
  if(sendBtn){
    sendBtn.addEventListener('click', sendChatMessage);
  }
  
  if(chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if(e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }

  // ------- Clear History -------
  window.clearHistory = function(tab) {
    const map = {
      summarizer: '#summarizerHistory',
      quiz: '#quizHistory',
      chat: '#chatHistory'
    };
    const container = qs(map[tab]);
    if(container) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-robot"></i><p>History cleared.</p></div>';
      toast(`${tab.charAt(0).toUpperCase() + tab.slice(1)} history cleared.`, 'info');
    }
  };
  
  // Add some CSS for better quiz styling
  const style = document.createElement('style');
  style.textContent = `
    .quiz-container { margin: 10px 0; }
    .quiz-list { padding-left: 20px; }
    .quiz-item { margin-bottom: 20px; padding: 15px; background: var(--bg-secondary); border-radius: 8px; }
    .question { font-weight: 600; margin-bottom: 10px; color: var(--text-primary); }
    .quiz-options { margin: 10px 0; padding-left: 20px; }
    .quiz-options li { margin: 5px 0; color: var(--text-secondary); }
    .quiz-answer { margin-top: 10px; padding: 10px; background: var(--success-color); color: white; border-radius: 4px; font-size: 0.9em; }
    .toast.warning { border-left-color: var(--warning-color); color: var(--warning-color); }
    .toast.success { border-left-color: var(--success-color); color: var(--success-color); }
    .toast.error { border-left-color: var(--danger-color); color: var(--danger-color); }
    .toast-close { background: none; border: none; color: inherit; cursor: pointer; font-size: 18px; font-weight: bold; }
  `;
  document.head.appendChild(style);
  
  console.log('🚀 LittleAI Frontend Initialized');
})();
