const vscode = acquireVsCodeApi();
const form = document.getElementById('chat-form');

// Add an event listener for form submission
form.addEventListener('submit', function(event) {
    // Prevent the default form submission (which reloads the page)
    event.preventDefault();

    // Get the value of the textarea
    const userInput = document.getElementById('user_msg').value;

    // Clear the textarea
    document.getElementById('user_msg').value = '';

    // Send user message to vscode extension
    vscode.postMessage({
        command: 'user_msg',
        text: userInput
    });
});

// Handle the message inside the webview
window.addEventListener('message', event => {

    const message = event.data; // The JSON data our extension sent

    switch (message.command) {
        case 'doUpdateContent':
            console.log('Update Detected!');

            const chatBubbles = document.querySelectorAll('#chat-container .chat-bubble');
            if (chatBubbles.length > 0) {
                const lastBubble = chatBubbles[chatBubbles.length - 1];

                // Change the text inside the <p> tag
                const lastBubbleText = lastBubble.querySelector('.markdown-container');
                lastBubbleText.innerHTML = '<button id="stop-btn">▢</button>\n'+ message.content; // Update the text here
            }
            break;
    }
});