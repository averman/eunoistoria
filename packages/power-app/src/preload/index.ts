import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('eunoistoria', {
  // Stub: will be populated in PA-002 and subsequent tasks
});
