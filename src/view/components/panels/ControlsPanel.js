import React, { useMemo, useRef, useEffect } from 'react';
import { stage } from 'global';
import Control from 'components/controls/Control';
import useApp from 'actions/app';
import useScenes from 'actions/scenes';
import styles from './ControlsPanel.less';

export function ControlsPanel() {
  const activeElementId = useApp(state => state.activeElementId);
  // scenes is the canonical source of truth from the zustand store
  const scenes = useScenes(state => state.scenes);
  const panelRef = useRef();

  // Keep previous input + result to avoid allocating a new displays array
  // when scenes have not changed by reference (shallow comparison by index).
  const prevScenesRef = useRef(null);
  const prevResultRef = useRef(null);

  const displays = useMemo(() => {
    // If scenes is identical to previous by reference per item, reuse cached result.
    const prevScenes = prevScenesRef.current;
    if (prevScenes && prevScenes.length === scenes.length) {
      let same = true;
      for (let i = 0; i < scenes.length; i++) {
        if (prevScenes[i] !== scenes[i]) {
          same = false;
          break;
        }
      }
      if (same && prevResultRef.current) {
        return prevResultRef.current;
      }
    }

    // Build the flattened list: scene, effects (reversed), displays (reversed)
    const result = [...scenes].reverse().reduce((arr, scene) => {
      arr.push(scene);
      // effects and displays are arrays of entity objects - keep references
      // but order matters so we reverse them for UI presentation
      return arr.concat([...scene.effects].reverse(), [...scene.displays].reverse());
    }, []);

    // Cache input references and computed result for next render
    prevScenesRef.current = scenes.slice();
    prevResultRef.current = result;
    return result;
  }, [scenes]);

  useEffect(() => {
    const node = document.getElementById(`control-${activeElementId}`);
    if (node && panelRef.current) {
      panelRef.current.scrollTop = node.offsetTop;
    }
  }, [activeElementId]);

  return (
    <div className={styles.panel} ref={panelRef}>
      {displays.map(display => {
        const { id } = display;

        return (
          <div id={`control-${id}`} key={id} className={styles.control}>
            <Control display={display} />
          </div>
        );
      })}
    </div>
  );
}

// Export memoized component to avoid re-rendering when props/state used by
// the component are stable (we rely on useScenes and useApp selectors above).
export default React.memo(ControlsPanel);
