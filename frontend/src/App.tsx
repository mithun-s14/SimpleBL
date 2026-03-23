import { useState } from 'react';
import Header from './components/Header';
import TabBar from './components/TabBar';
import SearchPanel from './components/SearchPanel';
import ChatPanel from './components/ChatPanel';

type ActiveTab = 'search' | 'chat';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('search');

  return (
    <div className="min-h-screen bg-[#f0f4f2]">
      <div className="max-w-content mx-auto px-4 py-8 sm:py-10">
        <Header />
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="mt-6">
          {activeTab === 'search' ? <SearchPanel /> : <ChatPanel />}
        </div>
      </div>
    </div>
  );
}
