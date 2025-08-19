import React, { useEffect } from 'react';
import { ignoreEvents } from 'utils/react';
import Layout from 'components/layout/Layout';
import Modals from 'components/window/Modals';
import Preload from 'components/window/Preload';
import StatusBar from 'components/window/StatusBar';
import TitleBar from 'components/window/TitleBar';
import ControlDock from 'components/panels/ControlDock';
import ReactorPanel from 'components/panels/ReactorPanel';
import Player from 'components/player/Player';
import Stage from 'components/stage/Stage';
import ErrorBoundary from 'components/common/ErrorBoundary';
import { initApp } from 'actions/app';

function App() {
  async function init() {
    await initApp();
  }

  useEffect(() => {
    init();
  }, []);

  return (
    <ErrorBoundary>
      <Layout direction="column" onDrop={ignoreEvents} onDragOver={ignoreEvents} full>
        <Preload />
        <TitleBar />
        <Layout direction="row">
          <Layout id="viewport" direction="column">
            <ErrorBoundary>
              <Stage />
            </ErrorBoundary>

            <ErrorBoundary>
              <Player />
            </ErrorBoundary>

            <ErrorBoundary>
              <ReactorPanel />
            </ErrorBoundary>
          </Layout>

          <ErrorBoundary>
            <ControlDock />
          </ErrorBoundary>
        </Layout>
        <StatusBar />
        <Modals />
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
