var Class = require('../utils/Class');
var Frame = require('./AnimationFrame');
var GetValue = require('../utils/object/GetValue');

//  A Frame based Animation
//  This consists of a key, some default values (like the frame rate) and a bunch of Frame objects.
//  The Animation Manager creates these
//  Game Objects don't own an instance of these directly
//  Game Objects have the Animation Component, which are like playheads to global Animations (these objects)
//  So multiple Game Objects can have playheads all pointing to this one Animation instance

//  Phaser.Animations.Animation

var Animation = new Class({

    initialize:

    function Animation (manager, key, config)
    {
        this.manager = manager;

        this.key = key;

        //  A frame based animation (as opposed to a bone based animation)
        this.type = 'frame';

        //  Extract all the frame data into the frames array
        this.frames = this.getFrames(
            manager.textureManager,
            GetValue(config, 'frames', []),
            GetValue(config, 'defaultTextureKey', null)
        );

        //  The frame rate of playback in frames per second (default 24 if duration is null)
        this.frameRate = GetValue(config, 'frameRate', null);

        //  How long the animation should play for. If frameRate is set it overrides this value
        //  otherwise frameRate is derived from duration
        this.duration = GetValue(config, 'duration', null);

        if (this.duration === null && this.frameRate === null)
        {
            //  No duration or frameRate given, use default frameRate of 24fps
            this.frameRate = 24;
            this.duration = this.frameRate / this.frames.length;
        }
        else if (this.duration && this.frameRate === null)
        {
            //  Duration given but no frameRate, so set the frameRate based on duration
            //  I.e. 12 frames in the animation, duration = 4 (4000 ms)
            //  So frameRate is 12 / 4 = 3 fps
            this.frameRate = this.frames.length / this.duration;
        }
        else
        {
            //  frameRate given, derive duration from it (even if duration also specified)
            //  I.e. 15 frames in the animation, frameRate = 30 fps
            //  So duration is 15 / 30 = 0.5 (half a second)
            this.duration = this.frames.length / this.frameRate;
        }

        //  ms per frame (without including frame specific modifiers)
        this.msPerFrame = 1000 / this.frameRate;

        //  Skip frames if the time lags, or always advanced anyway?
        this.skipMissedFrames = GetValue(config, 'skipMissedFrames', true);

        //  Delay before starting playback (in seconds)
        this.delay = GetValue(config, 'delay', 0);

        //  Number of times to repeat the animation (-1 for infinity)
        this.repeat = GetValue(config, 'repeat', 0);

        //  Delay before the repeat starts (in seconds)
        this.repeatDelay = GetValue(config, 'repeatDelay', 0);

        //  Should the animation yoyo? (reverse back down to the start) before repeating?
        this.yoyo = GetValue(config, 'yoyo', false);

        //  Should sprite.visible = true when the animation starts to play?
        this.showOnStart = GetValue(config, 'showOnStart', false);

        //  Should sprite.visible = false when the animation finishes?
        this.hideOnComplete = GetValue(config, 'hideOnComplete', false);

        //  Callbacks
        this.callbackScope = GetValue(config, 'callbackScope', this);

        this.onStart = GetValue(config, 'onStart', false);
        this.onStartParams = GetValue(config, 'onStartParams', []);

        this.onRepeat = GetValue(config, 'onRepeat', false);
        this.onRepeatParams = GetValue(config, 'onRepeatParams', []);

        //  Called for EVERY frame of the animation.
        //  See AnimationFrame.onUpdate for a frame specific callback.
        this.onUpdate = GetValue(config, 'onUpdate', false);
        this.onUpdateParams = GetValue(config, 'onUpdateParams', []);

        this.onComplete = GetValue(config, 'onComplete', false);
        this.onCompleteParams = GetValue(config, 'onCompleteParams', []);

        //  Global pause, effects all Game Objects using this Animation instance
        this.paused = false;

        this.manager.on('pauseall', this.pause.bind(this));
        this.manager.on('resumeall', this.resume.bind(this));
    },

    //  config = Array of Animation config objects, like:
    //  [
    //      { key: 'gems', frame: 'diamond0001', [duration], [visible], [onUpdate] }
    //  ]

    //  Add frames to the end of the animation

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#addFrame
     * @since 3.0.0
     *
     * @param {[type]} config - [description]
     *
     * @return {Phaser.Animations.Animation} [description]
     */
    addFrame: function (config)
    {
        return this.addFrameAt(this.frames.length, config);
    },

    //  config = Array of Animation config objects, like:
    //  [
    //      { key: 'gems', frame: 'diamond0001', [duration], [visible], [onUpdate] }
    //  ]

    //  Add frame/s into the animation

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#addFrameAt
     * @since 3.0.0
     *
     * @param {integer} index - [description]
     * @param {[type]} config - [description]
     *
     * @return {Phaser.Animations.Animation} [description]
     */
    addFrameAt: function (index, config)
    {
        var newFrames = this.getFrames(this.manager.textureManager, config);

        if (newFrames.length > 0)
        {
            if (index === 0)
            {
                this.frames = newFrames.concat(this.frames);
            }
            else if (index === this.frames.length)
            {
                this.frames = this.frames.concat(newFrames);
            }
            else
            {
                var pre = this.frames.slice(0, index);
                var post = this.frames.slice(index);

                this.frames = pre.concat(newFrames, post);
            }

            this.updateFrameSequence();
        }

        return this;
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#checkFrame
     * @since 3.0.0
     *
     * @param {integer} index - [description]
     *
     * @return {boolean} [description]
     */
    checkFrame: function (index)
    {
        return (index < this.frames.length);
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#completeAnimation
     * @since 3.0.0
     *
     * @param {Phaser.GameObjects.Components.Animation} component - [description]
     */
    completeAnimation: function (component)
    {
        if (this.hideOnComplete)
        {
            component.parent.visible = false;
        }

        component.stop(true);
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#getFirstTick
     * @since 3.0.0
     *
     * @param {Phaser.GameObjects.Components.Animation} component - [description]
     * @param {boolean} [includeDelay=true] - [description]
     */
    getFirstTick: function (component, includeDelay)
    {
        if (includeDelay === undefined) { includeDelay = true; }

        //  When is the first update due?
        component.accumulator = 0;
        component.nextTick = component.msPerFrame + component.currentFrame.duration;

        if (includeDelay)
        {
            component.nextTick += (component._delay * 1000);
        }
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#getFrameAt
     * @since 3.0.0
     *
     * @param {integer} index - [description]
     *
     * @return {Phaser.Animations.AnimationFrame} [description]
     */
    getFrameAt: function (index)
    {
        return this.frames[index];
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#getFrames
     * @since 3.0.0
     *
     * @param {[type]} textureManager - [description]
     * @param {[type]} frames - [description]
     *
     * @return {Phaser.Animations.AnimationFrame[]} [description]
     */
    getFrames: function (textureManager, frames, defaultTextureKey)
    {
        //      frames: [
        //          { key: textureKey, frame: textureFrame },
        //          { key: textureKey, frame: textureFrame, duration: float },
        //          { key: textureKey, frame: textureFrame, onUpdate: function }
        //          { key: textureKey, frame: textureFrame, visible: boolean }
        //      ],

        var out = [];
        var prev;
        var animationFrame;
        var index = 1;
        var i;
        var textureKey;

        //  if frames is a string, we'll get all the frames from the texture manager as if it's a sprite sheet
        if (typeof frames === 'string')
        {
            textureKey = frames;

            var texture = textureManager.get(textureKey);
            var frameKeys = texture.getFrameNames();

            frames = [];

            frameKeys.forEach(function (idx, value)
            {
                frames.push({ key: textureKey, frame: value });
            });
        }

        // console.table(frames);

        if (!Array.isArray(frames) || frames.length === 0)
        {
            return out;
        }

        for (i = 0; i < frames.length; i++)
        {
            var item = frames[i];

            var key = GetValue(item, 'key', defaultTextureKey);

            if (!key)
            {
                continue;
            }

            var frame = GetValue(item, 'frame', 0);

            var textureFrame = textureManager.getFrame(key, frame);

            animationFrame = new Frame(key, frame, index, textureFrame);

            animationFrame.duration = GetValue(item, 'duration', 0);
            animationFrame.onUpdate = GetValue(item, 'onUpdate', null);

            var visible = GetValue(item, 'visible', null);

            if (visible !== null)
            {
                animationFrame.setVisible = true;
                animationFrame.visible = visible;
            }

            animationFrame.isFirst = (!prev);

            //  The previously created animationFrame
            if (prev)
            {
                prev.nextFrame = animationFrame;

                animationFrame.prevFrame = prev;
            }

            out.push(animationFrame);

            prev = animationFrame;

            index++;
        }

        if (out.length > 0)
        {
            animationFrame.isLast = true;

            //  Link them end-to-end, so they loop
            animationFrame.nextFrame = out[0];

            out[0].prevFrame = animationFrame;

            //  Generate the progress data

            var slice = 1 / (out.length - 1);

            for (i = 0; i < out.length; i++)
            {
                out[i].progress = i * slice;
            }
        }

        return out;
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#getNextTick
     * @since 3.0.0
     *
     * @param {Phaser.GameObjects.Components.Animation} component - [description]
     */
    getNextTick: function (component)
    {
        // accumulator += delta * _timeScale
        // after a large delta surge (perf issue for example) we need to adjust for it here

        //  When is the next update due?
        component.accumulator -= component.nextTick;

        component.nextTick = component.msPerFrame + component.currentFrame.duration;
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#load
     * @since 3.0.0
     *
     * @param {Phaser.GameObjects.Components.Animation} component - [description]
     * @param {integer} startFrame - [description]
     */
    load: function (component, startFrame)
    {
        if (startFrame >= this.frames.length)
        {
            startFrame = 0;
        }

        if (component.currentAnim !== this)
        {
            component.currentAnim = this;

            component._timeScale = 1;
            component.frameRate = this.frameRate;
            component.duration = this.duration;
            component.msPerFrame = this.msPerFrame;
            component.skipMissedFrames = this.skipMissedFrames;
            component._delay = this.delay;
            component._repeat = this.repeat;
            component._repeatDelay = this.repeatDelay;
            component._yoyo = this.yoyo;
            component._callbackArgs[1] = this;
            component._updateParams = component._callbackArgs.concat(this.onUpdateParams);
        }

        component.updateFrame(this.frames[startFrame]);
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#nextFrame
     * @since 3.0.0
     *
     * @param {Phaser.GameObjects.Components.Animation} component - [description]
     */
    nextFrame: function (component)
    {
        var frame = component.currentFrame;

        //  TODO: Add frame skip support

        if (frame.isLast)
        {
            //  We're at the end of the animation

            //  Yoyo? (happens before repeat)
            if (this.yoyo)
            {
                component.forward = false;

                component.updateFrame(frame.prevFrame);

                //  Delay for the current frame
                this.getNextTick(component);
            }
            else if (component.repeatCounter > 0)
            {
                //  Repeat (happens before complete)
                this.repeatAnimation(component);
            }
            else
            {
                this.completeAnimation(component);
            }
        }
        else
        {
            component.updateFrame(frame.nextFrame);

            this.getNextTick(component);
        }
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#previousFrame
     * @since 3.0.0
     *
     * @param {Phaser.GameObjects.Components.Animation} component - [description]
     */
    previousFrame: function (component)
    {
        var frame = component.currentFrame;

        //  TODO: Add frame skip support

        if (frame.isFirst)
        {
            //  We're at the start of the animation

            if (component.repeatCounter > 0)
            {
                //  Repeat (happens before complete)
                this.repeatAnimation(component);
            }
            else
            {
                this.completeAnimation(component);
            }
        }
        else
        {
            component.updateFrame(frame.prevFrame);

            this.getNextTick(component);
        }
    },

    //  Remove frame if it matches the given frame
    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#removeFrame
     * @since 3.0.0
     *
     * @param {Phaser.Animations.AnimationFrame} frame - [description]
     *
     * @return {Phaser.Animations.Animation} [description]
     */
    removeFrame: function (frame)
    {
        var index = this.frames.indexOf(frame);

        if (index !== -1)
        {
            this.removeFrameAt(index);
        }

        return this;
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#removeFrameAt
     * @since 3.0.0
     *
     * @param {integer} index - [description]
     *
     * @return {Phaser.Animations.Animation} [description]
     */
    removeFrameAt: function (index)
    {
        this.frames.splice(index, 1);

        this.updateFrameSequence();

        return this;
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#repeatAnimation
     * @since 3.0.0
     *
     * @param {Phaser.GameObjects.Components.Animation} component - [description]
     */
    repeatAnimation: function (component)
    {
        if (component._repeatDelay > 0 && component.pendingRepeat === false)
        {
            component.pendingRepeat = true;
            component.accumulator -= component.nextTick;
            component.nextTick += (component._repeatDelay * 1000);
        }
        else
        {
            component.repeatCounter--;

            component.forward = true;

            component.updateFrame(component.currentFrame.nextFrame);

            this.getNextTick(component);

            component.pendingRepeat = false;

            if (this.onRepeat)
            {
                this.onRepeat.apply(this.callbackScope, component._callbackArgs.concat(this.onRepeatParams));
            }
        }
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#setFrame
     * @since 3.0.0
     *
     * @param {Phaser.GameObjects.Components.Animation} component - [description]
     */
    setFrame: function (component)
    {
        //  Work out which frame should be set next on the child, and set it
        if (component.forward)
        {
            this.nextFrame(component);
        }
        else
        {
            this.previousFrame(component);
        }
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#toJSON
     * @since 3.0.0
     *
     * @return {object} [description]
     */
    toJSON: function ()
    {
        var output = {
            key: this.key,
            type: this.type,
            frames: [],
            frameRate: this.frameRate,
            duration: this.duration,
            skipMissedFrames: this.skipMissedFrames,
            delay: this.delay,
            repeat: this.repeat,
            repeatDelay: this.repeatDelay,
            yoyo: this.yoyo,
            showOnStart: this.showOnStart,
            hideOnComplete: this.hideOnComplete
        };

        this.frames.forEach(function (frame)
        {
            output.frames.push(frame.toJSON());
        });

        return output;
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#updateFrameSequence
     * @since 3.0.0
     *
     * @return {Phaser.Animations.Animation} [description]
     */
    updateFrameSequence: function ()
    {
        var len = this.frames.length;
        var slice = 1 / (len - 1);

        for (var i = 0; i < len; i++)
        {
            var frame = this.frames[i];

            frame.index = i + 1;
            frame.isFirst = false;
            frame.isLast = false;
            frame.progress = i * slice;

            if (i === 0)
            {
                frame.isFirst = true;
                frame.isLast = (len === 1);
                frame.prevFrame = this.frames[len - 1];
                frame.nextFrame = this.frames[i + 1];
            }
            else if (i === len - 1)
            {
                frame.isLast = true;
                frame.prevFrame = this.frames[len - 2];
                frame.nextFrame = this.frames[0];
            }
            else if (len > 1)
            {
                frame.prevFrame = this.frames[i - 1];
                frame.nextFrame = this.frames[i + 1];
            }
        }

        return this;
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#pause
     * @since 3.0.0
     *
     * @return {Phaser.Animations.Animation} [description]
     */
    pause: function ()
    {
        this.paused = true;

        return this;
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#resume
     * @since 3.0.0
     *
     * @return {Phaser.Animations.Animation} [description]
     */
    resume: function ()
    {
        this.paused = false;

        return this;
    },

    /**
     * [description]
     *
     * @method Phaser.Animations.Animation#destroy
     * @since 3.0.0
     */
    destroy: function ()
    {
        //  TODO
    }

});

module.exports = Animation;
