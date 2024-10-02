const puppeteer = require('puppeteer');
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai")

const startWhatsAppBot = async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    await page.goto('https://web.whatsapp.com/');
    console.log('Please scan the QR code to connect to WhatsApp Web.');

    // Wait until the user logs in
    await page.waitForSelector('.x1n2onr6', { timeout: 0 });
    console.log('Logged in successfully.');

    // Start polling for new messages in unopened chats
    await pollForNewChats(page);
};

const lastMessages = {}; // Object to store last processed messages by chat ID

const pollForNewChats = async (page) => {
    console.log('Polling for new chats...');

    setInterval(async () => {
        try {
            // Selector to find chats with unread messages
            const unreadChatSelector = 'div[role="listitem"] div[role="gridcell"]';
            const unreadChat = await page.$(unreadChatSelector);

            if (unreadChat) {
                console.log('New message in unopened chat detected.');
                

                // Get the parent list item of the unread chat
                const chatItemHandle = await unreadChat.evaluateHandle(el => el.closest('div[role="listitem"]'));
                const chatId = await chatItemHandle.evaluate(el => el.getAttribute('data-id')); // Assuming there's a way to get a unique chat ID
                
                if (chatItemHandle) {
                    console.log('Chat item found, clicking to open the chat.');
                    await chatItemHandle.click(); // Click to open the chat

                    // Wait for the chat to load and detect the last message
                    await page.waitForSelector('.message-in .selectable-text span');
                    const newMessage = await page.evaluate(() => {
                        const messageElems = document.querySelectorAll('.message-in .selectable-text span');
                        return messageElems[messageElems.length - 1].textContent;
                    });

                    // Check if the message is new for this chat
                    if (newMessage && newMessage !== lastMessages[chatId]) {
                        console.log('New message:', newMessage);
                        lastMessages[chatId] = newMessage; // Update the last message for this chat
                        
                        // Respond to the new message
                        await handleMessage(newMessage, page);
                    } else {
                        console.log('No new messages to respond to.');
                    }
                } else {
                    console.log('Chat item handle is undefined. Could not click the chat.');
                }
            } else {
                console.log('No new messages in unopened chats.');
            }
        } catch (err) {
            console.error('Error detecting new chats:', err);
        }
    }, 5000); // Poll every 5 seconds (adjustable)
};





const handleMessage = async (message, page) => {
    const response = await generateAIResponse(message);

    if (typeof response !== 'string' || response.trim() === '') {
        console.error('Invalid response text:', response);
        return;
    }

    // Type the response into the message box
    const inputSelector = 'footer div[contenteditable="true"]';

    try {
        await page.waitForSelector(inputSelector);

        // Clear the message box before typing (optional, but might be helpful to avoid previous message interference)
        await page.evaluate((selector) => {
            const inputBox = document.querySelector(selector);
            if (inputBox) inputBox.innerHTML = '';
        }, inputSelector);

        // Type the response
        await page.type(inputSelector, response);

        // Send the response by simulating pressing 'Enter'
        await page.keyboard.press('Enter');

        console.log('Response sent:', response);
    } catch (err) {
        console.error('Error sending response:', err);
    }
};


const generateResponse = (message) => {
    if (typeof message === 'string' && message.toLowerCase().includes('hi')) {
        return 'Hello there! Lelo here, how can I help you?';
    }

    return "I'm not sure how to respond to that.";
};


const API_KEY = process.env.API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const generateAIResponse = async (message) => {
    try {
        const completion = await model.generateContent(message);
        const aiResponse = completion.response.text();
       if (aiResponse) {
        return aiResponse;
       } else {
       return 'There is still an issue';
    }
    } catch (err) {
        console.error('Failed to generate response: ', err);
    }
}; 

startWhatsAppBot();
