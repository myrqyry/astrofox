import React, { useMemo, useCallback } from 'react';
import classNames from 'classnames';
import Layer from 'components/panels/Layer';
import { Picture, Cube, LightUp, DocumentLandscape } from 'view/icons';
import { reverse } from 'utils/array';
import styles from './SceneLayer.less';

const icons = {
  display: DocumentLandscape,
  effect: LightUp,
  webgl: Cube,
};

function SceneLayer({ scene, activeElementId, onLayerClick, onLayerUpdate }) {
  const { id, displayName, enabled } = scene;

  const displays = useMemo(() => reverse(scene.displays), [scene.displays]);
  const effects = useMemo(() => reverse(scene.effects), [scene.effects]);

  // Stable render function so child Layer receives stable props where possible
  const renderLayer = useCallback(
    ({ id: childId, type, displayName: childName, enabled: childEnabled }) => (
      <Layer
        key={childId}
        id={childId}
        name={childName}
        icon={icons[type]}
        className={styles.child}
        enabled={childEnabled}
        active={childId === activeElementId}
        onLayerClick={onLayerClick}
        onLayerUpdate={onLayerUpdate}
      />
    ),
    [activeElementId, onLayerClick, onLayerUpdate],
  );

  return (
    <div className={styles.contaainer}>
      <Layer
        key={id}
        id={id}
        name={displayName}
        icon={Picture}
        enabled={enabled}
        active={id === activeElementId}
        onLayerClick={onLayerClick}
        onLayerUpdate={onLayerUpdate}
      />
      <div className={classNames(styles.children)}>
        {effects.map(effect => renderLayer(effect))}
        {displays.map(display => renderLayer(display))}
      </div>
    </div>
  );
}

export default React.memo(SceneLayer);
