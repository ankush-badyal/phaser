var Camera = require('./Camera');
var Class = require('../../utils/Class');
var Vector3 = require('../../math/Vector3');

//  Local cache vars
var tmpVec3 = new Vector3();

//  Phaser.Cameras.Sprite3D.OrthographicCamera

var OrthographicCamera = new Class({

    Extends: Camera,

    initialize:

    function OrthographicCamera (scene, viewportWidth, viewportHeight)
    {
        if (viewportWidth === undefined) { viewportWidth = 0; }
        if (viewportHeight === undefined) { viewportHeight = 0; }

        Camera.call(this, scene);

        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;

        this._zoom = 1.0;

        this.near = 0;

        this.update();
    },

    setToOrtho: function (yDown, viewportWidth, viewportHeight)
    {
        if (viewportWidth === undefined) { viewportWidth = this.viewportWidth; }
        if (viewportHeight === undefined) { viewportHeight = this.viewportHeight; }

        var zoom = this.zoom;

        this.up.set(0, (yDown) ? -1 : 1, 0);
        this.direction.set(0, 0, (yDown) ? 1 : -1);
        this.position.set(zoom * viewportWidth / 2, zoom * viewportHeight / 2, 0);

        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;

        return this.update();
    },

    update: function ()
    {
        var w = this.viewportWidth;
        var h = this.viewportHeight;
        var near = Math.abs(this.near);
        var far = Math.abs(this.far);
        var zoom = this.zoom;

        if (w === 0 || h === 0)
        {
            //  What to do here... hmm?
            return this;
        }

        this.projection.ortho(
            zoom * -w / 2, zoom * w / 2,
            zoom * -h / 2, zoom * h / 2,
            near,
            far
        );

        //  Build the view matrix 
        tmpVec3.copy(this.position).add(this.direction);

        this.view.lookAt(this.position, tmpVec3, this.up);

        //  Projection * view matrix
        this.combined.copy(this.projection).multiply(this.view);

        //  Invert combined matrix, used for unproject
        this.invProjectionView.copy(this.combined).invert();

        this.billboardMatrixDirty = true;

        this.updateChildren();

        return this;
    },

    zoom: {

        get: function ()
        {
            return this._zoom;
        },

        set: function (value)
        {
            this._zoom = value;
            this.update();
        }
    }

});

module.exports = OrthographicCamera;
