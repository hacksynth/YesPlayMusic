<template>
  <div class="player" @click="toggleLyrics">
    <div
      class="progress-bar"
      :class="{
        nyancat: settings.nyancatStyle,
        'nyancat-stop': settings.nyancatStyle && !player.playing,
      }"
      @click.stop
    >
      <input
        class="native-slider progress-slider"
        type="range"
        :value="player.progress"
        :min="0"
        :max="player.currentTrackDuration"
        step="1"
        :title="formatTrackTime(player.progress)"
        :style="progressSliderStyle"
        @input="setProgressFromEvent"
        @change="setProgressFromEvent"
      />
    </div>
    <div class="controls">
      <div class="playing">
        <div class="container" @click.stop>
          <img
            :src="resizeImage(currentTrack.al && currentTrack.al.picUrl, 224)"
            loading="lazy"
            @click="goToAlbum"
          />
          <div class="track-info" :title="audioSource">
            <div
              :class="['name', { 'has-list': hasList() }]"
              @click="hasList() && goToList()"
            >
              {{ currentTrack.name }}
            </div>
            <div class="artist">
              <span
                v-for="(ar, index) in currentTrack.ar"
                :key="ar.id"
                @click="ar.id && goToArtist(ar.id)"
              >
                <span :class="{ ar: ar.id }"> {{ ar.name }} </span
                ><span v-if="index !== currentTrack.ar.length - 1">, </span>
              </span>
            </div>
          </div>
          <div class="like-button">
            <button-icon
              :title="
                player.isCurrentTrackLiked
                  ? $t('player.unlike')
                  : $t('player.like')
              "
              @click="likeATrack(player.currentTrack.id)"
            >
              <svg-icon
                v-show="!player.isCurrentTrackLiked"
                icon-class="heart"
              ></svg-icon>
              <svg-icon
                v-show="player.isCurrentTrackLiked"
                icon-class="heart-solid"
              ></svg-icon>
            </button-icon>
          </div>
        </div>
        <div class="blank"></div>
      </div>
      <div class="middle-control-buttons">
        <div class="blank"></div>
        <div class="container" @click.stop>
          <button-icon
            v-show="!player.isPersonalFM"
            :title="$t('player.previous')"
            @click="playPrevTrack"
            ><svg-icon icon-class="previous"
          /></button-icon>
          <button-icon
            v-show="player.isPersonalFM"
            title="不喜欢"
            @click="moveToFMTrash"
            ><svg-icon icon-class="thumbs-down"
          /></button-icon>
          <button-icon
            class="play"
            :title="$t(player.playing ? 'player.pause' : 'player.play')"
            @click="playOrPause"
          >
            <svg-icon :icon-class="player.playing ? 'pause' : 'play'"
          /></button-icon>
          <button-icon :title="$t('player.next')" @click="playNextTrack"
            ><svg-icon icon-class="next"
          /></button-icon>
        </div>
        <div class="blank"></div>
      </div>
      <div class="right-control-buttons">
        <div class="blank"></div>
        <div class="container" @click.stop>
          <button-icon
            :title="$t('player.nextUp')"
            :class="{
              active: $route.name === 'next',
              disabled: player.isPersonalFM,
            }"
            @click="goToNextTracksPage"
            ><svg-icon icon-class="list"
          /></button-icon>
          <button-icon
            :class="{
              active: player.repeatMode !== 'off',
              disabled: player.isPersonalFM,
            }"
            :title="
              player.repeatMode === 'one'
                ? $t('player.repeatTrack')
                : $t('player.repeat')
            "
            @click="switchRepeatMode"
          >
            <svg-icon
              v-show="player.repeatMode !== 'one'"
              icon-class="repeat"
            />
            <svg-icon
              v-show="player.repeatMode === 'one'"
              icon-class="repeat-1"
            />
          </button-icon>
          <button-icon
            :class="{ active: player.shuffle, disabled: player.isPersonalFM }"
            :title="$t('player.shuffle')"
            @click="switchShuffle"
            ><svg-icon icon-class="shuffle"
          /></button-icon>
          <button-icon
            v-if="settings.enableReversedMode"
            :class="{ active: player.reversed, disabled: player.isPersonalFM }"
            :title="$t('player.reversed')"
            @click="switchReversed"
            ><svg-icon icon-class="sort-up"
          /></button-icon>
          <div class="volume-control">
            <button-icon :title="$t('player.mute')" @click="mute">
              <svg-icon v-show="volume > 0.5" icon-class="volume" />
              <svg-icon v-show="volume === 0" icon-class="volume-mute" />
              <svg-icon
                v-show="volume <= 0.5 && volume !== 0"
                icon-class="volume-half"
              />
            </button-icon>
            <div class="volume-bar">
              <input
                class="native-slider volume-slider"
                type="range"
                :value="volume"
                :min="0"
                :max="1"
                step="0.01"
                :style="volumeSliderStyle"
                @input="setVolumeFromEvent"
                @change="setVolumeFromEvent"
              />
            </div>
          </div>

          <button-icon
            class="lyrics-button"
            title="歌词"
            style="margin-left: 12px"
            @click="toggleLyrics"
            ><svg-icon icon-class="arrow-up"
          /></button-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapMutations, mapActions } from 'vuex';
import '@/assets/css/slider.css';

import ButtonIcon from '@/components/ButtonIcon.vue';
import { goToListSource, hasListSource } from '@/utils/playList';
import { formatTrackTime } from '@/utils/common';

export default {
  name: 'Player',
  components: {
    ButtonIcon,
  },
  computed: {
    ...mapState(['player', 'settings', 'data']),
    currentTrack() {
      return this.player.currentTrack;
    },
    volume: {
      get() {
        return this.player.volume;
      },
      set(value) {
        this.player.volume = value;
      },
    },
    playing() {
      return this.player.playing;
    },
    audioSource() {
      return this.player._howler?._src.includes('kuwo.cn')
        ? '音源来自酷我音乐'
        : '';
    },
    progressSliderStyle() {
      const duration = this.player.currentTrackDuration || 1;
      return {
        '--slider-percent': `${(this.player.progress / duration) * 100}%`,
      };
    },
    volumeSliderStyle() {
      return {
        '--slider-percent': `${this.volume * 100}%`,
      };
    },
  },
  mounted() {
    this.setupMediaControls();
    window.addEventListener('keydown', this.handleKeydown);
  },
  beforeDestroy() {
    window.removeEventListener('keydown', this.handleKeydown);
  },
  methods: {
    ...mapMutations(['toggleLyrics']),
    ...mapActions(['showToast', 'likeATrack']),
    playPrevTrack() {
      this.player.playPrevTrack();
    },
    playOrPause() {
      this.player.playOrPause();
    },
    playNextTrack() {
      if (this.player.isPersonalFM) {
        this.player.playNextFMTrack();
      } else {
        this.player.playNextTrack();
      }
    },
    goToNextTracksPage() {
      if (this.player.isPersonalFM) return;
      this.$route.name === 'next'
        ? this.$router.go(-1)
        : this.$router.push({ name: 'next' });
    },
    formatTrackTime(value) {
      return formatTrackTime(value);
    },
    setProgressFromEvent(event) {
      this.player.progress = Number(event.target.value);
    },
    setVolumeFromEvent(event) {
      this.player.volume = Number(event.target.value);
    },
    hasList() {
      return hasListSource();
    },
    goToList() {
      goToListSource();
    },
    goToAlbum() {
      if (this.player.currentTrack.al.id === 0) return;
      this.$router.push({ path: '/album/' + this.player.currentTrack.al.id });
    },
    goToArtist(id) {
      this.$router.push({ path: '/artist/' + id });
    },
    moveToFMTrash() {
      this.player.moveToFMTrash();
    },
    switchRepeatMode() {
      this.player.switchRepeatMode();
    },
    switchShuffle() {
      this.player.switchShuffle();
    },
    switchReversed() {
      this.player.switchReversed();
    },
    mute() {
      this.player.mute();
    },

    setupMediaControls() {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
          this.playOrPause();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          this.playOrPause();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          this.playPrevTrack();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          this.playNextTrack();
        });
      }
    },

    handleKeydown(event) {
      switch (event.code) {
        case 'MediaPlayPause':
          this.playOrPause();
          break;
        case 'MediaTrackPrevious':
          this.playPrevTrack();
          break;
        case 'MediaTrackNext':
          this.playNextTrack();
          break;
        default:
          break;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.player {
  position: fixed;
  bottom: 0;
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  height: 64px;
  backdrop-filter: saturate(180%) blur(30px);
  // background-color: rgba(255, 255, 255, 0.86);
  background-color: var(--color-navbar-bg);
  z-index: 100;
}

@supports (-moz-appearance: none) {
  .player {
    background-color: var(--color-body-bg);
  }
}

.progress-bar {
  margin-top: -6px;
  margin-bottom: -6px;
  width: 100%;
}

.native-slider {
  display: block;
  width: 100%;
  height: 14px;
  margin: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  appearance: none;
}

.native-slider::-webkit-slider-runnable-track {
  height: 2px;
  border-radius: 15px;
  background: linear-gradient(
    to right,
    var(--color-primary) 0%,
    var(--color-primary) var(--slider-percent),
    rgba(128, 128, 128, 0.18) var(--slider-percent),
    rgba(128, 128, 128, 0.18) 100%
  );
}

.native-slider::-webkit-slider-thumb {
  width: 12px;
  height: 12px;
  margin-top: -5px;
  border: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0.5px 0.5px 2px 1px rgba(0, 0, 0, 0.12);
  opacity: 0;
  appearance: none;
}

.native-slider:hover::-webkit-slider-thumb,
.native-slider:active::-webkit-slider-thumb {
  opacity: 1;
}

.native-slider::-moz-range-track {
  height: 2px;
  border-radius: 15px;
  background: rgba(128, 128, 128, 0.18);
}

.native-slider::-moz-range-progress {
  height: 2px;
  border-radius: 15px;
  background: var(--color-primary);
}

.native-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0.5px 0.5px 2px 1px rgba(0, 0, 0, 0.12);
  opacity: 0;
}

.native-slider:hover::-moz-range-thumb,
.native-slider:active::-moz-range-thumb {
  opacity: 1;
}

.volume-control .native-slider::-webkit-slider-runnable-track {
  background: linear-gradient(
    to right,
    var(--color-text) 0%,
    var(--color-text) var(--slider-percent),
    rgba(128, 128, 128, 0.18) var(--slider-percent),
    rgba(128, 128, 128, 0.18) 100%
  );
}

.volume-control:hover .native-slider::-webkit-slider-runnable-track {
  background: linear-gradient(
    to right,
    var(--color-primary) 0%,
    var(--color-primary) var(--slider-percent),
    rgba(128, 128, 128, 0.18) var(--slider-percent),
    rgba(128, 128, 128, 0.18) 100%
  );
}

.volume-control .native-slider::-moz-range-track,
.volume-control .native-slider::-moz-range-progress {
  background: var(--color-text);
  opacity: 0.8;
}

.volume-control:hover .native-slider::-moz-range-track,
.volume-control:hover .native-slider::-moz-range-progress {
  background: var(--color-primary);
}

.controls {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  height: 100%;
  padding: {
    right: 10vw;
    left: 10vw;
  }
}

@media (max-width: 1336px) {
  .controls {
    padding: 0 5vw;
  }
}

.blank {
  flex-grow: 1;
}

.playing {
  display: flex;
}

.playing .container {
  display: flex;
  align-items: center;
  img {
    height: 46px;
    border-radius: 5px;
    box-shadow: 0 6px 8px -2px rgba(0, 0, 0, 0.16);
    cursor: pointer;
    user-select: none;
  }
  .track-info {
    height: 46px;
    margin-left: 12px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    .name {
      font-weight: 600;
      font-size: 16px;
      opacity: 0.88;
      color: var(--color-text);
      margin-bottom: 4px;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      overflow: hidden;
      word-break: break-all;
    }
    .has-list {
      cursor: pointer;
      &:hover {
        text-decoration: underline;
      }
    }
    .artist {
      font-size: 12px;
      opacity: 0.58;
      color: var(--color-text);
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      overflow: hidden;
      word-break: break-all;
      span.ar {
        cursor: pointer;
        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}

.middle-control-buttons {
  display: flex;
}

.middle-control-buttons .container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 8px;
  .button-icon {
    margin: 0 8px;
  }
  .play {
    height: 42px;
    width: 42px;
    :deep(.svg-icon) {
      width: 24px;
      height: 24px;
    }
  }
}

.right-control-buttons {
  display: flex;
}

.right-control-buttons .container {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  .expand {
    margin-left: 24px;
    :deep(.svg-icon) {
      height: 24px;
      width: 24px;
    }
  }
  .active :deep(.svg-icon) {
    color: var(--color-primary);
  }
  .volume-control {
    margin-left: 4px;
    display: flex;
    align-items: center;
    .volume-bar {
      width: 84px;
    }
  }
}

.like-button {
  margin-left: 16px;
}

.button-icon.disabled {
  cursor: default;
  opacity: 0.38;
  &:hover {
    background: none;
  }
  &:active {
    transform: unset;
  }
}
</style>
