import Header from './components/Header';
import SearchPanel from './components/SearchPanel';

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-content mx-auto px-4 py-8 sm:py-10">
        <Header />
        <div className="mt-6">
          <SearchPanel />
        </div>
      </div>
    </div>
  );
}
