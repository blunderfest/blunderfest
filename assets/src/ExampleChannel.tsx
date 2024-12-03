import React, { useEffect, useState } from 'react';
import { Socket } from 'phoenix';

interface Message {
  message: string;
}

const ExampleChannel: React.FC = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState<string>('');
  const [channel, setChannel] = useState<any>(null);

  useEffect(() => {
    // Connect to the Phoenix socket
    const socket = new Socket('/socket', { params: { user_token: '123' } });
    socket.connect();

    // Join the "example:lobby" channel
    const newChannel = socket.channel('room:lobby', {});
    setChannel(newChannel);

    // Handle the 'welcome' event when joining the channel
    newChannel.on('welcome', (payload: Message) => {
      setMessages((prevMessages) => [...prevMessages, payload.message]);
    });

    // Handle the 'shout' event when a message is broadcasted
    newChannel.on('shout', (payload: Message) => {
      setMessages((prevMessages) => [...prevMessages, payload.message]);
    });

    // Join the channel and handle success or error
    newChannel
      .join()
      .receive('ok', (resp: any) => {
        console.log('Joined successfully', resp);
      })
      .receive('error', (resp: any) => {
        console.log('Unable to join', resp);
      });

    // Clean up when the component unmounts
    return () => {
      newChannel.leave();
      socket.disconnect();
    };
  }, []);

  // Send a message to the channel
  const sendShout = () => {
    if (input && channel) {
      channel.push('shout', { message: input });
      setInput(''); // Clear input after sending
    }
  };

  return (
    <div>
      <h1>Example Channel</h1>
      <div>
        {messages.map((msg, idx) => (
          <div key={idx}>{msg}</div>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Send a shout"
      />
      <button onClick={sendShout}>Send</button>
    </div>
  );
};

export default ExampleChannel;
