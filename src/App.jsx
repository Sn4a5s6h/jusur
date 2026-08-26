import { useState, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';

const API = 'https://jusur.onrender.com' // سيرفر Render

function App() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef();
  const recognitionRef = useRef(null);

  // 1. انشاء مسودة فاتورة
  const createDraft = async (data) => {
    setLoading(true);
    const res = await fetch(API+'/api/draft-invoice', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(data)
    })
    const result = await res.json();
    setLoading(false);
    return result;
  }

  // 2. اعتماد الفاتورة
  const approveInvoice = async (id) => {
    setLoading(true);
    const res = await fetch(`${API}/api/approve-invoice/${id}`, {method:'POST'});
    const result = await res.json();
    setLoading(false);
    return result;
  }

  // 3. جلب كشف حساب
  const getCustomerBalance = async (name) => {
    const res = await fetch(`${API}/api/customer/${name}`);
    return res.json();
  }

  // تحويل نص لصوت
  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  // فهم الأوامر الصوتية
  const processCommand = async (text) => {
    setTranscript(text);

    // مثال: "بيع لاحمد 5 سكر سعر 4 نقدي"
    if(text.includes('بيع ل')){
      try {
        const customer = text.split('بيع ل')[1].split(' ')[0];
        const qty = parseFloat(text.match(/\d+/)?.[0] || 1);
        const price = parseFloat(text.match(/سعر (\d+)/)?.[1] || 0);
        const total = qty * price;
        const type = text.includes('نقدي')? 'نقدي' : 'أجل';
        const itemName = text.match(/كيلو|حبة|كرتون/)? text.split(' ')[3] : 'صنف';

        const data = {
          customer,
          customer_phone: '',
          items: [{name: itemName, qty, price}],
          total,
          type
        };

        const result = await createDraft(data);
        if(result.success){
          setDraft(result.invoice);
          speak(`تم تجهيز فاتورة ${customer} بمبلغ ${total} ريال ${type}. قل اعتماد`);
        }
      } catch(e){
        speak('ما فهمت الأمر. عيد مرة ثانية');
      }
    }

    // "اعتمد"
    if(text.includes('اعتمد') && draft){
      const result = await approveInvoice(draft.id);
      if(result.success){
        speak('تم اعتماد الفاتورة وترحيلها');
        setDraft(null);
        handlePrint();
      }
    }

    // "كم رصيد احمد"
    if(text.includes('كم رصيد')){
      const name = text.split('رصيد')[1].trim();
      const data = await getCustomerBalance(name);
      speak(`رصيد ${name} الحالي ${data.customer.balance} ريال`);
    }

    // "الغي"
    if(text.includes('الغي')){
      setDraft(null);
      speak('تم الغاء المسودة');
    }
  };

  // اعداد التعرف على الصوت
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(SpeechRecognition){
      const rec = new SpeechRecognition();
      rec.lang = 'ar-SA';
      rec.continuous = true;
      rec.onresult = (e) => {
        const text = e.results[e.results.length - 1][0].transcript;
        processCommand(text);
      };
      recognitionRef.current = rec;
    }
  }, [draft]);

  const toggleListening = () => {
    if(!recognitionRef.current) return alert('المتصفح لا يدعم الصوت. استخدم كروم');
    if(listening) recognitionRef.current.stop();
    else recognitionRef.current.start();
    setListening(!listening);
  };

  // طباعة الفاتورة
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: draft?.inv_no || 'فاتورة'
  });

  return (
    <div className="p-4 max-w-2xl mx-auto font-sans" dir="rtl">
      <h1 className="text-2xl font-bold mb-4">🌉 جسور المحاسبي الصوتي</h1>

      <button
        onClick={toggleListening}
        disabled={loading}
        className={`w-full p-4 rounded-xl text-white text-lg font-bold ${listening? 'bg-red-500' : 'bg-green-600'} disabled:bg-gray-400`}>
        {loading? '...جاري التنفيذ' : listening? '🔴 ايقاف الاستماع' : '🎤 ابدأ الاستماع'}
      </button>

      <div className="mt-4 p-3 bg-gray-100 rounded">
        <b>آخر أمر:</b> {transcript || 'تكلم الآن...'}
      </div>

      {draft && (
        <div ref={printRef} className="mt-6 p-4 border-2 border-dashed rounded bg-white">
          <h2 className="font-bold text-center">فاتورة مبيعات</h2>
          <p><b>رقم:</b> {draft.inv_no}</p>
          <p><b>العميل:</b> {draft.customer}</p>
          <hr className="my-2"/>
          {draft.items.map((item, i) => (
            <div key={i} className="flex justify-between">
              <span>{item.qty} x {item.name}</span>
              <span>{item.qty * item.price} ريال</span>
            </div>
          ))}
          <hr className="my-2"/>
          <p className="font-bold"><b>الإجمالي:</b> {draft.total} ريال - {draft.type}</p>

          <button
            onClick={() => processCommand('اعتمد')}
            className="w-full bg-blue-600 text-white p-2 rounded mt-3">
            1️⃣ اعتماد وطباعة
          </button>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-600">
        <b>الأوامر:</b> "بيع لـ احمد 5 سكر سعر 4 نقدي", "اعتمد", "كم رصيد محمد"
      </div>
    </div>
  );
}
export default App;
