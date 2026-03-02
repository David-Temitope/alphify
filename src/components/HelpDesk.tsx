import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';

const helpItems = [
  {
    id: 'preferences',
    title: 'How to set up your preferences',
    content: `1. Go to **Settings** → **Profile** tab
2. Enter your preferred name — this is how Ezra will address you
3. Tell Ezra about yourself in the bio field (hobbies, interests) so it uses relatable examples
4. Select your explanation style (e.g. "Like a 5-year-old" for simple explanations)
5. Choose your field of study and university level
6. Pick your AI personality — you can select multiple! (e.g. Close Friend + Funny)
7. Add your course codes so Ezra knows what you're studying
8. Tap **Save** at the top

💡 Tip: The more you fill out, the better Ezra understands you!`,
  },
  {
    id: 'chat',
    title: 'How to chat with Ezra effectively',
    content: `1. Start a new chat from the Dashboard by tapping **Ask Ezra**
2. Be specific with your questions — instead of "explain biology", try "explain photosynthesis in simple terms"
3. You can ask follow-up questions in the same conversation
4. Use the 🔊 speaker icon to have Ezra read responses aloud
5. Each prompt costs 1 KU from your wallet

💡 Tips for better responses:
- Mention your course code (e.g. "In CHM 101, explain...")
- Ask Ezra to give examples
- Say "explain like I'm 5" if something is too complex
- Ask "quiz me" to test your understanding`,
  },
  {
    id: 'exam',
    title: 'How to use Exam Mode',
    content: `1. Tap **Exam Mode** from the Dashboard
2. Select a course from your course list
3. Choose the exam type (MCQ, Theory, or Mixed)
4. Set your preferred time limit
5. Ezra generates questions based on your course — and if you uploaded past exam papers, it matches your professor's style!
6. Answer the questions within the time limit
7. Submit to get your score and review correct answers

💡 Tip: Upload past exam papers in Settings → Exam Question Style for more accurate questions. Exam mode costs 70 KU.`,
  },
  {
    id: 'library',
    title: 'How to use the Library',
    content: `1. Go to **Library** from the bottom navigation
2. Tap the upload button to add a document (PDF, images)
3. Ezra extracts text from your files so you can ask questions about them
4. You start with 1 library slot — buy more for 5 KU each
5. Reference uploaded files in your chats for context-aware answers

💡 Tip: Upload your lecture notes and ask Ezra to summarize or quiz you on them!`,
  },
  {
    id: 'buy-ku',
    title: 'How to buy Knowledge Units',
    content: `1. Go to **Settings** → **Wallet** tab
2. Choose a package (Starter, Standard, Bulk, or Mega) or enter a custom amount
3. Tap **Buy** to open the payment window
4. Pay via card or bank transfer
5. KU is credited instantly for card payments
6. For bank transfers, tap **Verify** after completing the transfer, or wait — it auto-credits within 2 hours

💡 Tip: 1 KU = 1 standard prompt (₦35). Assignment Assist costs 2 KU per prompt.`,
  },
  {
    id: 'study-groups',
    title: 'How to use Study Groups',
    content: `1. Go to **Community** from the bottom navigation
2. Create a group or join one with a group code
3. As a group admin, you can create study sessions with a topic and duration
4. Group members join sessions and learn together with Ezra
5. Groups have their own KU wallet — the admin can top it up

💡 Tip: Study sessions use KU from the group wallet, not your personal wallet.`,
  },
  {
    id: 'referrals',
    title: 'How to refer friends',
    content: `1. Go to **Settings** → **Profile** tab
2. Find your unique referral code
3. Share it with friends via the Share button
4. When your friend signs up and makes their first KU purchase, you earn **5 free KU!**

💡 Tip: There's no limit to how many friends you can refer!`,
  },
  {
    id: 'assignment',
    title: 'How to use Assignment Assist',
    content: `1. From the Dashboard, tap **Assignment**
2. This opens a special chat mode designed for assignments
3. Each prompt in Assignment Assist costs **2 KU** (instead of the usual 1 KU)
4. Ezra provides more detailed, structured answers suitable for assignments
5. You can upload related documents for better context

💡 Tip: Be clear about what your assignment requires — include the question and any guidelines from your lecturer.`,
  },
];

export default function HelpDesk() {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-card border border-border">
        <h2 className="font-display text-base font-semibold mb-1">How can we help?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Find answers to common questions about using Alphify and Ezra.
        </p>

        <Accordion type="single" collapsible className="w-full">
          {helpItems.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger className="text-sm text-left">
                {item.title}
              </AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {item.content.split('\n').map((line, i) => (
                    <p key={i} className="text-sm text-muted-foreground leading-relaxed my-1">
                      {line.replace(/\*\*(.*?)\*\*/g, '').includes('**') ? line : line.split(/\*\*(.*?)\*\*/).map((part, j) =>
                        j % 2 === 1 ? <strong key={j} className="text-foreground">{part}</strong> : part
                      )}
                    </p>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
