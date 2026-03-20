import { useEffect } from 'react';
import { useProjectStore } from './store/project-store';

export default function App() {
  const { project, isLoading, error, resumeProject, setError } = useProjectStore();

  useEffect(() => {
    // On mount, try to resume last active project
    resumeProject();
  }, [resumeProject]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => setError(null)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // No project state - show empty screen (PA-003 will add UI for new/open)
  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Eunoistoria</h1>
          <p className="text-gray-600 mb-8">No project loaded. Use File menu to create or open a project.</p>
          <div className="space-y-2">
            <button className="block w-48 mx-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Create New Project
            </button>
            <button className="block w-48 mx-auto px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
              Open Project
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active project state
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">Eunoistoria</h1>
        <p className="text-gray-600">Project: {project.name}</p>
        <p className="text-sm text-gray-500 mt-2">ID: {project.uuid}</p>
        {project.isDirty && <p className="text-sm text-orange-600 mt-2">Unsaved changes</p>}
      </div>
    </div>
  );
}
