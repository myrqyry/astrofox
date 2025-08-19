import React, { useMemo, useCallback } from 'react';
import SceneLayer from 'components/panels/SceneLayer';
import Layout from 'components/layout/Layout';
import ButtonPanel from 'components/layout/ButtonPanel';
import { ButtonInput } from 'components/inputs';
import useApp, { setActiveElementId } from 'actions/app';
import useScenes, {
  addElement,
  addScene,
  moveElement,
  removeElement,
  updateElement,
} from 'actions/scenes';
import { showModal } from 'actions/modals';
import { Picture, Cube, LightUp, ChevronUp, ChevronDown, TrashEmpty } from 'view/icons';
import { reverse } from 'utils/array';
import styles from './LayersPanel.less';

function LayersPanel() {
  const scenes = useScenes(state => state.scenes);
  const activeElementId = useApp(state => state.activeElementId);
  const hasScenes = scenes.length > 0;
  const layerSelected = hasScenes && activeElementId;

  const sortedScenes = useMemo(() => reverse(scenes), [scenes]);

  const activeScene = useMemo(() => {
    return scenes.reduce((memo, scene) => {
      if (!memo) {
        if (
          scene?.id === activeElementId ||
          scene?.displays.find(e => e.id === activeElementId) ||
          scene?.effects.find(e => e.id === activeElementId)
        ) {
          memo = scene;
        }
      }
      return memo;
    }, undefined);
  }, [scenes, activeElementId]);

  const handleAddControl = useCallback(
    Entity => {
      const entity = new Entity();
      setActiveElementId(entity?.id);
      // addElement is imported and assumed stable
      addElement(entity, activeScene?.id);
    },
    [activeScene],
  );

  const handleLayerClick = useCallback(id => setActiveElementId(id), []);

  const handleLayerUpdate = useCallback((id, prop, value) => updateElement(id, prop, value), []);

  const handleAddScene = useCallback(async () => {
    const scene = await addScene();
    setActiveElementId(scene?.id);
  }, []);

  const handleAddDisplay = useCallback(() => {
    showModal('ControlPicker', { title: 'Controls' }, { type: 'displays', onSelect: handleAddControl });
  }, [handleAddControl]);

  const handleAddEffect = useCallback(() => {
    showModal('ControlPicker', { title: 'Controls' }, { type: 'effects', onSelect: handleAddControl });
  }, [handleAddControl]);

  const handleMoveUp = useCallback(() => moveElement(activeElementId, 1), [activeElementId]);
  const handleMoveDown = useCallback(() => moveElement(activeElementId, -1), [activeElementId]);

  const handleRemove = useCallback(() => {
    if (!activeElementId) return;

    if (activeElementId === activeScene?.id) {
      const newScene = sortedScenes.find(e => e !== activeScene);
      setActiveElementId(newScene?.id);
    } else {
      const scene = sortedScenes.find(e => e === activeScene);

      if (scene) {
        const { displays, effects } = scene;
        const element =
          reverse(displays).find(e => e !== activeElementId) ||
          reverse(effects).find(e => e !== activeElementId);

        if (element) {
          setActiveElementId(element?.id);
        } else {
          setActiveElementId(activeScene?.id);
        }
      }
    }

    removeElement(activeElementId);
  }, [activeElementId, activeScene, sortedScenes]);

  return (
    <Layout className={styles.panel}>
      <div className={styles.layers}>
        {sortedScenes.map(scene => (
          <SceneLayer
            key={scene.id}
            scene={scene}
            activeElementId={activeElementId}
            onLayerClick={handleLayerClick}
            onLayerUpdate={handleLayerUpdate}
          />
        ))}
      </div>
      <ButtonPanel>
        <ButtonInput icon={Picture} title="Add Scene" onClick={handleAddScene} />
        <ButtonInput
          icon={Cube}
          title="Add Display"
          onClick={handleAddDisplay}
          disabled={!hasScenes}
        />
        <ButtonInput
          icon={LightUp}
          title="Add Effect"
          onClick={handleAddEffect}
          disabled={!hasScenes}
        />
        <ButtonInput
          icon={ChevronUp}
          title="Move Layer Up"
          onClick={handleMoveUp}
          disabled={!layerSelected}
        />
        <ButtonInput
          icon={ChevronDown}
          title="Move Layer Down"
          onClick={handleMoveDown}
          disabled={!layerSelected}
        />
        <ButtonInput
          icon={TrashEmpty}
          title="Delete Layer"
          onClick={handleRemove}
          disabled={!layerSelected}
        />
      </ButtonPanel>
    </Layout>
  );
}

// Memoize the component to avoid rerenders when parent updates but internal selectors/hooks didn't change
export default React.memo(LayersPanel);
