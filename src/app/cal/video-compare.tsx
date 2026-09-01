'use client';

import { useEffect, useRef, useState } from 'react';
import './video-compare.css';

const VIDEO_PAIRS = {
  '계산대': { keeper: '/video/Keeper계산대-홀방향.mp4', s1: '/video/S1계산대-홀방향.mp4' },
  '안쪽': { keeper: '/video/Keeper안쪽-홀방향.mp4', s1: '/video/S1안쪽-홀방향.mp4' },
  '안쪽입구': { keeper: '/video/Keeper안쪽입구-홀방향.mp4', s1: '/video/S1안쪽입구-홀방향.mp4' },
  '입구': { keeper: '/video/Keeper입구-홀방향.mp4', s1: '/video/S1입구-홀방향.mp4' },
} as const;

const TABS = ['계산대', '안쪽', '안쪽입구', '입구'] as const;
type TabKey = typeof TABS[number];

export default function VideoCompare() {
  const [activeTab, setActiveTab] = useState<TabKey>('계산대');
  const [playing, setPlaying] = useState(false);

  const leftRef = useRef<HTMLVideoElement>(null);
  const rightRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    leftRef.current?.load();
    rightRef.current?.load();
    if (playing) {
      leftRef.current?.play();
      rightRef.current?.play();
    }
  }, [activeTab]);

  function handlePlayPause() {
    if (playing) {
      leftRef.current?.pause();
      rightRef.current?.pause();
      setPlaying(false);
    } else {
      leftRef.current?.play();
      rightRef.current?.play();
      setPlaying(true);
    }
  }

  const pair = VIDEO_PAIRS[activeTab];

  return (
    <section className="vc-section">
      <div className="vc-eyebrow">화질 비교</div>
      <h2 className="vc-title">
        같은 매장, 같은 위치 —{' '}
        <span className="vc-accent">화질 차이</span>를 직접 확인하세요.
      </h2>
      <p className="vc-lede">
        Keeper 카메라는 105° 광화각으로 매장 전체를 한 프레임에 담습니다. 같은 매장의 같은 위치에서 촬영한 경쟁사 S1 모델과 화각·선명도를 비교해보세요.
      </p>

      <div className="vc-wrap">
        <div className="vc-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`vc-tab${activeTab === tab ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="vc-grid">
          <div className="vc-card vc-card-keeper">
            <div className="vc-card-label">
              Keeper
              <span className="vc-card-badge">105° 광화각</span>
            </div>
            <video
              ref={leftRef}
              src={pair.keeper}
              muted
              loop
              playsInline
              preload="metadata"
            />
          </div>

          <div className="vc-card vc-card-s1">
            <div className="vc-card-label">
              S1 · 경쟁사 (비교용)
              <span className="vc-card-badge vc-card-badge-muted">일반 화각</span>
            </div>
            <video
              ref={rightRef}
              src={pair.s1}
              muted
              loop
              playsInline
              preload="metadata"
            />
          </div>
        </div>

        <div className="vc-controls">
          <button
            type="button"
            className={`vc-play-btn${playing ? ' is-playing' : ' is-paused'}`}
            onClick={handlePlayPause}
          >
            {playing ? '⏸ 일시정지' : '▶ 동시 재생'}
          </button>
          <p className="vc-controls-note">
            두 영상은 동일 시점·동일 매장에서 촬영했습니다. 음소거 상태로 자동 재생됩니다.
          </p>
        </div>
      </div>
    </section>
  );
}
