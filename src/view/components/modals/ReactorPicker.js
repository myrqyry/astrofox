import React from 'react';
import AudioReactor from 'audio/AudioReactor';
import FeatureReactor from 'audio/FeatureReactor';
import styles from './ControlPicker.less';

const reactors = [AudioReactor, FeatureReactor];

export default function ReactorPicker({ onSelect, onClose }) {
  function handleClick(item) {
    onSelect(item);
    onClose();
  }

  return (
    <div className={styles.picker}>
      {reactors.map((reactor, index) => {
        const {
          config: { icon, label },
        } = reactor;

        return (
          <div key={index} className={styles.item}>
            <div className={styles.image} onClick={() => handleClick(reactor)}>
              <img
                src={icon || 'images/controls/Plugin.png'}
                alt={label}
              />
            </div>
            <div className={styles.name}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}
