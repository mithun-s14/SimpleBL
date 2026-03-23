type ActiveTab = 'search' | 'chat';

interface TabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
      <button
        onClick={() => onTabChange('search')}
        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
          activeTab === 'search'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        Literature Search
      </button>
      <button
        onClick={() => onTabChange('chat')}
        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
          activeTab === 'chat'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        AI Chat
      </button>
    </div>
  );
}
