// app.js - Web Speech API & Backend Communication

document.addEventListener('DOMContentLoaded', () => {
  const micBtn = document.getElementById('mic-btn');
  const visualizer = document.querySelector('.visualizer-container');
  const transcriptText = document.getElementById('transcript-text');
  const instructionText = document.getElementById('instruction-text');
  const actionResult = document.getElementById('action-result');
  const rosDot = document.getElementById('ros-dot');
  const rosStatus = document.getElementById('ros-status');
  const chips = document.querySelectorAll('.chip');
  const toastContainer = document.getElementById('toast-container');

  let recognition = null;
  let isRecording = false;

  // Check Web Speech API support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    showToast('Your browser does not support Speech Recognition. Please use Chrome.', 'error');
    micBtn.style.opacity = '0.5';
    micBtn.style.cursor = 'not-allowed';
    instructionText.textContent = 'Voice not supported on this browser';
    return;
  }

  // Setup Speech Recognition
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add('recording');
    visualizer.classList.add('listening');
    instructionText.textContent = 'Listening...';
    transcriptText.textContent = '...';
    transcriptText.style.opacity = '0.7';
    hideActionResult();
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (interimTranscript) {
      transcriptText.textContent = interimTranscript;
    }

    if (finalTranscript) {
      transcriptText.textContent = finalTranscript;
      transcriptText.style.opacity = '1';
      sendCommand(finalTranscript);
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error);
    stopRecording();
    if (event.error === 'no-speech') {
      showToast('No speech detected (timeout)', 'info');
    } else {
      showToast(`Microphone error: ${event.error}`, 'error');
    }
    instructionText.textContent = 'Tap the mic and say a command';
  };

  recognition.onend = () => {
    stopRecording();
  };

  // UI Event Listeners
  micBtn.addEventListener('click', () => {
    if (isRecording) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (e) {
        console.error(e);
      }
    }
  });

  // Allow clicking chips to test commands
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const command = chip.textContent.replace(/"/g, '');
      transcriptText.textContent = command;
      transcriptText.style.opacity = '1';
      sendCommand(command);
    });
  });

  // State Management
  function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    visualizer.classList.remove('listening');
    instructionText.textContent = 'Tap the mic and say a command';
    
    // Reset text if nothing was captured
    if (transcriptText.textContent === '...') {
      transcriptText.textContent = 'Waiting for voice...';
    }
  }

  function showActionResult(msg, type = 'success') {
    actionResult.textContent = msg;
    actionResult.className = `action-result show ${type}`;
    
    // Auto hide after 3 seconds
    setTimeout(hideActionResult, 3000);
  }

  function hideActionResult() {
    actionResult.classList.remove('show');
    setTimeout(() => {
      if (!actionResult.classList.contains('show')) {
        actionResult.className = 'action-result';
        actionResult.textContent = '';
      }
    }, 300);
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    
    let color = 'white';
    if (type === 'success') color = 'var(--success)';
    if (type === 'error') color = 'var(--error)';

    toast.innerHTML = `<i class="fa-solid ${icon}" style="color: ${color}"></i> <span>${message}</span>`;
    
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Backend Communication
  async function sendCommand(commandText) {
    try {
      instructionText.textContent = 'Processing...';
      
      const response = await fetch('/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: commandText }),
      });

      const data = await response.json();

      if (response.ok) {
        showActionResult(`Executing: ${data.normalized}`, 'success');
      } else {
        showActionResult(`Unknown command`, 'error');
        console.warn('Unknown command:', commandText, data);
      }
    } catch (error) {
      console.error('Error sending command:', error);
      showActionResult('Failed to reach robot', 'error');
      showToast('Network error connecting to backend', 'error');
    } finally {
      if (!isRecording) {
        instructionText.textContent = 'Tap the mic and say a command';
      }
    }
  }

  // Health check polling
  async function checkHealth() {
    try {
      const response = await fetch('/health');
      const data = await response.json();
      
      if (data.ros_connected) {
        rosDot.className = 'dot connected';
        rosStatus.textContent = 'Robot Connected';
      } else {
        rosDot.className = 'dot disconnected';
        rosStatus.textContent = 'Robot Disconnected';
      }
    } catch (error) {
      rosDot.className = 'dot disconnected';
      rosStatus.textContent = 'Backend Offline';
    }
  }

  // Initial health check and then poll every 3 seconds
  checkHealth();
  setInterval(checkHealth, 3000);
});
