// LittleAI Frontend - Fixed Button Version
console.log('🚀 LittleAI Frontend Loading...');

(function(){
  // Utility functions
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));

  // Wait for DOM to be fully loaded
  function initializeApp() {
    console.log('📱 Initializing LittleAI App...');

    // ------- Helper Functions -------
    function showLoading(show = true) {
      const modal = qs('#loadingModal');
      if (modal) {
        modal.style.display = show ? 'flex' : 'none';
      }
      console.log(show ? '⏳ Loading shown' : '✅ Loading hidden');
    }

    function toast(msg, type = 'info') {
      console.log(`📢 Toast (${type}):`, msg);
      
      const container = qs('#toastContainer');
      if (!container) {
        alert(msg);
        return;
      }

      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `
        <span>${msg}</span>
        <button onclick="this.parentElement.remove()" style="margin-left: 10px; background: none; border: none; color: inherit; cursor: pointer; font-size: 16px;">×</button>
      `;
      
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
    }

    function appendMsg(containerSel, role, content) {
      const container = qs(containerSel);
      if (!container) {
        console.error('Container not found:', containerSel);
        return;
      }

      // Remove empty state
      const emptyState = container.querySelector('.empty-state');
      if (emptyState) emptyState.remove();

      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${role}`;
      
      if (typeof content === 'string' && content.includes('<')) {
        messageDiv.innerHTML = content;
      } else {
        messageDiv.textContent = content;
      }
      
      container.appendChild(messageDiv);
      container.scrollTop = container.scrollHeight;
      
      console.log(`💬 Message added to ${containerSel}:`, content.substring(0, 100) + '...');
    }

    // ------- Tab System -------
    function initializeTabs() {
      console.log('📑 Initializing tabs...');
      
      const tabButtons = qsa('.tab-btn');
      const tabContents = qsa('.tab-content');
      
      console.log('Found tabs:', tabButtons.length, 'Found content:', tabContents.length);
      
      tabButtons.forEach((button, index) => {
        console.log(`Tab ${index}:`, button.dataset.tab);
        
        button.addEventListener('click', () => {
          console.log('Tab clicked:', button.dataset.tab);
          
          // Remove active from all tabs
          tabButtons.forEach(btn => btn.classList.remove('active'));
          tabContents.forEach(content => content.classList.remove('active'));
          
          // Add active to clicked tab
          button.classList.add('active');
          
          const targetTab = qs(`#${button.dataset.tab}`);
          if (targetTab) {
            targetTab.classList.add('active');
            console.log('✅ Tab switched to:', button.dataset.tab);
          } else {
            console.error('❌ Tab content not found:', button.dataset.tab);
          }
        });
      });
    }

    // ------- Theme Toggle -------
    function initializeTheme() {
      console.log('🎨 Initializing theme...');
      
      const themeBtn = qs('#themeToggle');
      const themeIcon = qs('#themeIcon');
      
      function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (themeIcon) {
          themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
        try {
          localStorage.setItem('theme', theme);
        } catch (e) {
          console.log('Cannot save theme to localStorage');
        }
        console.log('🎨 Theme set to:', theme);
      }

      if (themeBtn) {
        themeBtn.addEventListener('click', () => {
          const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
          const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
          setTheme(newTheme);
        });
      }

      // Load saved theme
      try {
        const savedTheme = localStorage.getItem('theme') || 'light';
        setTheme(savedTheme);
      } catch (e) {
        setTheme('light');
      }
    }

    // ------- API Communication -------
    async function callAPI(action, payload) {
      console.log('🌐 API Call:', { action, payload });
      
      try {
        const response = await fetch('/api/groq', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action, payload })
        });

        console.log('📡 Response status:', response.status);
        
        const text = await response.text();
        console.log('📄 Response text (first 200 chars):', text.substring(0, 200));
        
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
        }

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        return data;
        
      } catch (error) {
        console.error('❌ API Error:', error);
        throw error;
      }
    }

    // ------- Summarizer Feature -------
    function initializeSummarizer() {
      console.log('📝 Initializing summarizer...');
      
      const summarizeBtn = qs('#summarizeBtn');
      const summarizerInput = qs('#summarizerInput');
      
      if (!summarizeBtn || !summarizerInput) {
        console.error('❌ Summarizer elements not found');
        return;
      }

      console.log('✅ Summarizer elements found');

      summarizeBtn.addEventListener('click', async () => {
        console.log('🔘 Summarize button clicked');
        
        const text = summarizerInput.value.trim();
        
        if (!text) {
          toast('Please enter some text to summarize!', 'warning');
          return;
        }

        if (text.length < 50) {
          toast('Please enter at least 50 characters for a meaningful summary.', 'warning');
          return;
        }

        // Update button state
        const originalHTML = summarizeBtn.innerHTML;
        summarizeBtn.disabled = true;
        summarizeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Summarizing...';
        
        showLoading(true);

        try {
          const response = await callAPI('summarize', { text });
          
          if (response.error) {
            throw new Error(response.error);
          }

          const summary = response.result || response.reply || 'No summary generated';
          appendMsg('#summarizerHistory', 'ai', summary);
          
          // Clear input
          summarizerInput.value = '';
          toast('Summary generated successfully!', 'success');
          
        } catch (error) {
          console.error('Summarizer error:', error);
          toast(`Error: ${error.message}`, 'error');
          
        } finally {
          summarizeBtn.disabled = false;
          summarizeBtn.innerHTML = originalHTML;
          showLoading(false);
        }
      });
    }

    // ------- Quiz Feature -------
    function initializeQuiz() {
      console.log('❓ Initializing quiz...');
      
      const quizBtn = qs('#generateQuizBtn');
      const quizInput = qs('#quizInput');
      
      if (!quizBtn || !quizInput) {
        console.error('❌ Quiz elements not found');
        return;
      }

      console.log('✅ Quiz elements found');

      quizBtn.addEventListener('click', async () => {
        console.log('🔘 Quiz button clicked');
        
        const topic = quizInput.value.trim();
        
        if (!topic) {
          toast('Please enter a topic for the quiz!', 'warning');
          return;
        }

        // Update button state
        const originalHTML = quizBtn.innerHTML;
        quizBtn.disabled = true;
        quizBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        
        showLoading(true);

        try {
          const response = await callAPI('quiz', { text: topic, count: 5 });
          
          if (response.error) {
            throw new Error(response.error);
          }

          // Handle different response formats
          const questions = response.questions || response.quiz || [];
          
          if (Array.isArray(questions) && questions.length > 0) {
            let html = `<div class="quiz-result"><h4>📝 Quiz: ${topic}</h4><ol>`;
            
            questions.forEach((q, index) => {
              if (typeof q === 'string') {
                html += `<li>${q}</li>`;
              } else {
                const question = q.question || q.q || `Question ${index + 1}`;
                html += `<li><strong>${question}</strong>`;
                
                if (q.options && Array.isArray(q.options)) {
                  html += '<ul>';
                  q.options.forEach(option => {
                    html += `<li>${option}</li>`;
                  });
                  html += '</ul>';
                }
                
                if (q.answer) {
                  html += `<p><strong>Answer:</strong> ${q.answer}</p>`;
                }
                
                html += '</li>';
              }
            });
            
            html += '</ol></div>';
            appendMsg('#quizHistory', 'ai', html);
          } else {
            // Fallback to raw response
            const fallback = response.raw || response.reply || JSON.stringify(response);
            appendMsg('#quizHistory', 'ai', fallback);
          }
          
          // Clear input
          quizInput.value = '';
          toast('Quiz generated successfully!', 'success');
          
        } catch (error) {
          console.error('Quiz error:', error);
          toast(`Error: ${error.message}`, 'error');
          
        } finally {
          quizBtn.disabled = false;
          quizBtn.innerHTML = originalHTML;
          showLoading(false);
        }
      });
    }

    // ------- Chat Feature -------
    function initializeChat() {
      console.log('💬 Initializing chat...');
      
      const sendBtn = qs('#sendChatBtn');
      const chatInput = qs('#chatInput');
      
      if (!sendBtn || !chatInput) {
        console.error('❌ Chat elements not found');
        return;
      }

      console.log('✅ Chat elements found');

      async function sendMessage() {
        const message = chatInput.value.trim();
        
        if (!message) {
          return;
        }

        // Add user message
        appendMsg('#chatHistory', 'user', message);
        chatInput.value = '';

        // Update button state
        const originalHTML = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
          const response = await callAPI('chat', { text: message });
          
          if (response.error) {
            throw new Error(response.error);
          }

          const reply = response.reply || response.result || 'No response received';
          appendMsg('#chatHistory', 'ai', reply);
          
        } catch (error) {
          console.error('Chat error:', error);
          appendMsg('#chatHistory', 'ai', `Sorry, I encountered an error: ${error.message}`);
          
        } finally {
          sendBtn.disabled = false;
          sendBtn.innerHTML = originalHTML;
        }
      }

      sendBtn.addEventListener('click', sendMessage);
      
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    // ------- Clear History Function -------
    window.clearHistory = function(tab) {
      console.log('🗑️ Clearing history for:', tab);
      
      const containers = {
        summarizer: '#summarizerHistory',
        quiz: '#quizHistory', 
        chat: '#chatHistory'
      };
      
      const container = qs(containers[tab]);
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-robot"></i>
            <p>History cleared.</p>
          </div>
        `;
        toast(`${tab.charAt(0).toUpperCase() + tab.slice(1)} history cleared!`, 'info');
      }
    };

    // ------- Initialize Everything -------
    console.log('🔧 Setting up all features...');
    
    initializeTabs();
    initializeTheme();
    initializeSummarizer();
    initializeQuiz();
    initializeChat();

    // Test API connection
    fetch('/api/test')
      .then(response => response.json())
      .then(data => {
        console.log('🧪 API Test Result:', data);
        if (!data.gemini_key_present) {
          toast('⚠️ Gemini API key not configured', 'warning');
        } else {
          console.log('✅ API is ready');
        }
      })
      .catch(error => {
        console.error('❌ API test failed:', error);
        toast('API connection failed - check server', 'error');
      });

    console.log('🎉 LittleAI Frontend Ready!');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }

})();

// Add some additional CSS for better styling
const additionalCSS = `
  .quiz-result { 
    background: var(--bg-secondary); 
    padding: 15px; 
    border-radius: 8px; 
    margin: 10px 0; 
  }
  .quiz-result h4 { 
    color: var(--primary-color); 
    margin-bottom: 15px; 
  }
  .quiz-result ol { 
    padding-left: 20px; 
  }
  .quiz-result li { 
    margin-bottom: 15px; 
  }
  .quiz-result ul { 
    margin: 10px 0; 
    padding-left: 20px; 
  }
  .toast {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .toast.success { border-left: 4px solid var(--success-color); }
  .toast.warning { border-left: 4px solid var(--warning-color); }
  .toast.error { border-left: 4px solid var(--danger-color); }
  .toast.info { border-left: 4px solid var(--info-color); }
`;

// Add CSS to page
if (document.head) {
  const style = document.createElement('style');
  style.textContent = additionalCSS;
  document.head.appendChild(style);
}
