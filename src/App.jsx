import { useState, useEffect } from 'react';

function App() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState(null);

  // محرك التعرف على الصوت
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'ar-SA'; // عربي سعودي
  recognition.continuous = true;

  recognition.onresult = (e) => {
    const text = e.results[e.results.length - 1][0].transcript;
    setTranscript(text);
    processCommand(text); // نفهم الأمر
  };

  // محرك فهم الأوامر البسيط
  const processCommand = async (text) => {
    if(text.includes('بيع ل')){
      // مثال: "بيع لاحمد 5 سكر سعر 4 نقدي"
      const customer = text.split('بيع ل')[1].split(' ')[0];
      const qty = text.match(/\d+/)[0];
      const price = text.match(/سعر (\d+)/)[1];
      const total = qty * price;
      const type = text.includes('نقدي')? 'نقدي' : 'أجل';

      const res = await fetch('http://localhost:3001/api/draft-invoice', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          customer,
          items: [{name: 'صنف', qty, price}],
          total, type
        })
      });
      const data = await res.json();
      setDraft(data.invoice);
      speak(`تم تجهيز فاتورة ${customer} بمبلغ ${total} ريال. هل أعتمد؟`);
    }

    if(text.includes('اعتمد') && draft){
      await fetch(`http://localhost:3001/api/approve-invoice/${draft.id}`, {method: 'POST'});
      speak('تم اعتماد الفاتورة وارسالها');
      setDraft(null);
    }
  };

  // تحويل نص لصوت
  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🌉 جسور المحاسبي الصوتي</h1>

      <button onClick={() => {setListening(!listening); listening? recognition.stop() : recognition.start();}}
        className={`p-4 rounded-full ${listening? 'bg-red-500' : 'bg-green-500'} text-white`}>
        {listening? '🎤 ايقاف' : '🎤 ابدأ الاستماع'}
      </button>

      <p className="mt-4">آخر أمر: {transcript}</p>

      {draft && (
        <div className="mt-6 p-4 border rounded">
          <h2>📄 مسودة فاتورة: {draft.inv_no}</h2>
          <p>العميل: {draft.customer}</p>
          <p>الإجمالي: {draft.total} ريال - {draft.type}</p>
          <button onClick={() => processCommand('اعتمد')} className="bg-blue-500 text-white p-2 rounded mt-2">
            1️⃣ اعتماد وارسل
          </button>
        </div>
      )}
    </div>
  );
}
export default App;
