const vscode = acquireVsCodeApi();
const form = document.getElementById('chat-form');
var isGenerating = false;
let userScrolled = false;

//document.querySelector('.clear-context').style.display = 'flex';

// Auto-resize textarea
function autoResizeTextarea() {
    const textarea = document.getElementById('user_msg');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

// Function to enable/disable input controls
function toggleGenerating(generating) {
    isGenerating = generating;
    console.log('[DEBUG] toggleGenerating function called: '+generating);
    const stopBtn = document.querySelector('.stop-generating');
    const clearBtn = document.querySelector('.clear-context');
    if (stopBtn) {
        stopBtn.style.display = generating ? 'flex' : 'none';
        clearBtn.style.display = generating ? 'none' : 'flex';
        console.log('[DEBUG] Stop button display:', stopBtn.style.display); // Debug log
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
    console.log('[DEBUG] ----- STARTING GENERATION -----');
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

// Add event listener for stop button
document.querySelector('.stop-generating').addEventListener('click', function() {
    vscode.postMessage({ command: 'stop' });
    toggleGenerating(false);
});

// Add event listener for clear button
document.querySelector('.clear-context').addEventListener('click', function() {
    vscode.postMessage({ command: 'clear' });
    toggleGenerating(false);
});

// Handle edit buttons
document.addEventListener('click', function(e) {
    if (e.target.closest('.edit-button')) {
        const chatBubble = e.target.closest('.chat-bubble');
        const editButton = chatBubble.querySelector('.edit-button');
        if (!chatBubble.classList.contains('last-user-message')) {return;}
        
        const contentDiv = chatBubble.querySelector('.markdown-container');
        const originalContent = contentDiv.textContent;
        
        // Make content editable and switch to send icon
        contentDiv.contentEditable = 'true';
        contentDiv.classList.add('editable-content');
        contentDiv.focus();
        
        // Change edit icon to send icon
        editButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 2L11 13"></path>
                <path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
            </svg>
        `;
        editButton.classList.add('editing');

        // Handle focus out to save changes
        contentDiv.addEventListener('blur', function onBlur() {
            const newContent = contentDiv.textContent.trim();
            contentDiv.contentEditable = 'false';
            contentDiv.classList.remove('editable-content');
            
            // Change back to edit icon
            editButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            `;
            editButton.classList.remove('editing');
            
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
        case 'toggleGenerating':
            console.log('MSG RECEIVED!');
            toggleGenerating(message.content);
            break;

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
            console.log('[DEBUG] <----- Generation complete ----->');
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