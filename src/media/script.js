const vscode = acquireVsCodeApi();
const form = document.getElementById('chat-form');
let isGenerating = false;
let userScrolled = false;

// Auto-resize textarea
function autoResizeTextarea() {
    const textarea = document.getElementById('user_msg');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

// Function to enable/disable input controls
function toggleGenerating(generating) {
    isGenerating = generating;
    const stopBtn = document.querySelector('.stop-generating');
    if (stopBtn) {
        stopBtn.style.display = generating ? 'flex' : 'none';
        console.log('Stop button display:', stopBtn.style.display); // Debug log
    }
    document.getElementById('user_msg').disabled = generating;
    document.querySelector('.submit-button').disabled = generating;
}

// Handle scroll events
document.getElementById('chat-container').addEventListener('scroll', function() {
    const container = this;
    const scrollDiff = container.scrollHeight - container.scrollTop - container.clientHeight;
    userScrolled = scrollDiff > 50;
});

// Function to scroll to bottom if user hasn't scrolled up
function scrollIfNeeded() {
    if (!userScrolled) {
        const container = document.getElementById('chat-container');
        container.scrollTop = container.scrollHeight;
    }
}

// Add event listener for textarea input
document.getElementById('user_msg').addEventListener('input', autoResizeTextarea);

// Add event listener for form submission
form.addEventListener('submit', function(event) {
    event.preventDefault();
    const userInput = document.getElementById('user_msg').value.trim();
    if (!userInput) {return;}

    document.getElementById('user_msg').value = '';
    document.getElementById('user_msg').style.height = '44px';
    userScrolled = false;
    toggleGenerating(true);

    vscode.postMessage({
        command: 'user_msg',
        text: userInput
    });
});

// Add event listener for stop button
document.querySelector('.stop-generating').addEventListener('click', function() {
    vscode.postMessage({ command: 'stop' });
    toggleGenerating(false);
});

// Mark last user message
function updateLastUserMessage() {
    const userBubbles = document.querySelectorAll('.chat-bubble');
    userBubbles.forEach(bubble => bubble.classList.remove('last-user-message'));
    
    const lastUserBubble = Array.from(userBubbles)
        .reverse()
        .find(bubble => bubble.querySelector('h2').textContent.trim() === 'You');
    
    if (lastUserBubble) {
        lastUserBubble.classList.add('last-user-message');
    }
}

// Handle edit buttons
document.addEventListener('click', function(e) {
    if (e.target.closest('.edit-button')) {
        const chatBubble = e.target.closest('.chat-bubble');
        if (!chatBubble.classList.contains('last-user-message')) {return;}
        
        const contentDiv = chatBubble.querySelector('.markdown-container');
        const originalContent = contentDiv.textContent;
        
        // Make content editable
        contentDiv.contentEditable = 'true';
        contentDiv.classList.add('editable-content');
        contentDiv.focus();

        // Handle focus out to save changes
        contentDiv.addEventListener('blur', function onBlur() {
            const newContent = contentDiv.textContent.trim();
            contentDiv.contentEditable = 'false';
            contentDiv.classList.remove('editable-content');
            
            if (newContent !== originalContent) {
                // Remove the last assistant message and regenerate
                const lastAssistantBubble = chatBubble.nextElementSibling;
                if (lastAssistantBubble) {
                    lastAssistantBubble.remove();
                }
                
                vscode.postMessage({
                    command: 'user_msg',
                    text: newContent,
                    isEdit: true
                });
            }
            
            contentDiv.removeEventListener('blur', onBlur);
        });

        // Handle enter key to save changes
        contentDiv.addEventListener('keydown', function onKeydown(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                contentDiv.blur();
            }
            contentDiv.removeEventListener('keydown', onKeydown);
        });
    }
});

// Handle messages from the extension
window.addEventListener('message', event => {
    const message = event.data;

    switch (message.command) {
        case 'doUpdateContent':
            const chatBubbles = document.querySelectorAll('#chat-container .chat-bubble');
            if (chatBubbles.length > 0) {
                const lastBubble = chatBubbles[chatBubbles.length - 1];
                const lastBubbleText = lastBubble.querySelector('.markdown-container');
                lastBubbleText.innerHTML = message.content;
                scrollIfNeeded();
            }
            updateLastUserMessage();
            break;
            
        case 'generationComplete':
            toggleGenerating(false);
            userScrolled = false;
            updateLastUserMessage();
            break;
    }
});

// Initial setup
document.addEventListener('DOMContentLoaded', function() {
    updateLastUserMessage();
    toggleGenerating(false); // Ensure stop button is hidden initially
});