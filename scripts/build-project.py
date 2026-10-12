#!/usr/bin/env python3
"""Update the GDevelop project from editable level data and shared JavaScript.

Existing artwork, extensions and legacy objects are preserved. New scenes use
Maker-prefixed objects. Run from any directory; no third-party packages needed.
"""
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
p = json.loads((ROOT / 'game.json').read_text())
levels = json.loads((ROOT / 'levels.json').read_text())
runtime = (ROOT / 'scripts' / 'gameplay.js').read_text()


def sprite(name, image):
    return dict(name=name, type='Sprite', variables=[], effects=[], behaviors=[],
                updateIfNotVisible=False, adaptCollisionMaskAutomatically=True,
                animations=[dict(name='Idle', useMultipleDirections=False, directions=[dict(
                    looping=False, timeBetweenFrames=0.1, sprites=[dict(
                        image=image, hasCustomCollisionMask=False, points=[], customCollisionMask=[],
                        originPoint=dict(name='origine', x=0, y=0),
                        centerPoint=dict(name='centre', automatic=True, x=0, y=0))])])])


def resource(name, file):
    resources = p['resources']['resources']
    resources[:] = [r for r in resources if r['name'] != name]
    resources.append(dict(kind='image', name=name, file=file, smoothed=True, userAdded=True))


for name in ('panel', 'orb'):
    resource('maker-' + name, 'assets/shops/' + name + '.svg')
for level in levels:
    resource('maker-' + level['id'], 'assets/shops/' + level['id'] + '.png')

# Local copies already supplied with the project replace asset-store URLs.
for r in p['resources']['resources']:
    if r.get('file', '').startswith('https:') and (ROOT / 'assets' / r['name']).is_file():
        r['file'] = 'assets/' + r['name']

objects = [sprite('MakerPanel', 'maker-panel'), sprite('MakerOrb', 'maker-orb')]
for level in levels:
    objects.append(sprite('MakerBackdrop_' + level['id'], 'maker-' + level['id']))
objects.append(sprite('MakerTitleArt', 'ChatGPT Image Apr 14, 2025, 06_14_09 PM.png'))
robot = sprite('MakerRobot', 'Idle2')
original = next(o for o in p['objects'] if o['name'] == 'Red_Robot')
robot['animations'] = copy.deepcopy(original['animations'])
for a in robot['animations']:
    for d in a['directions']:
        for s in d['sprites']:
            s.update(hasCustomCollisionMask=False, customCollisionMask=[])
            s['originPoint'] = dict(name='origine', x=0, y=0)
objects.append(robot)
text = copy.deepcopy(next(o for o in p['objects'] if o['name'] == 'Instruction'))
text.update(name='MakerText', string='', characterSize=24, font='')
text.pop('persistentUuid', None)
text['content'].update(text='', characterSize=24, font='', color='246;239;221')
objects.append(text)
p['objects'] = [o for o in p['objects'] if not o['name'].startswith('Maker')] + objects

base = copy.deepcopy(next(l for l in p['layouts'] if l['name'] == 'Woodshop'))
names = ['Title Screen', 'Shop Map'] + [l['scene'] for l in levels]
scenes = []
for name in names:
    scene = copy.deepcopy(base)
    scene.update(name=name, objects=[], instances=[], variables=[], objectsGroups=[])
    scene.pop('persistentUuid', None)
    scene['layers'] = [copy.deepcopy(next(l for l in base['layers'] if l['name'] == ''))]
    scene['layers'][0]['visibility'] = True
    scene['layers'][0]['effects'] = []
    scene['events'] = [dict(type='BuiltinCommonInstructions::Comment', comment=
        'Edit levels.json and scripts/gameplay.js, then run python3 scripts/build-project.py. '
        'Maker objects are native GDevelop sprites/text; gameplay uses a fixed-step simulation.'),
        dict(type='BuiltinCommonInstructions::JsCode', inlineCode=(
            'const MAKER_LEVELS = ' + json.dumps(levels) + ';\n' + runtime).splitlines(),
            parameterObjects='', useStrict=True, eventsSheetExpanded=False)]
    scenes.append(scene)
p['layouts'] = scenes + [l for l in p['layouts'] if l['name'] not in names]
p['firstLayout'] = 'Title Screen'
p['properties'].update(name='MakeHaven: Make Something', description=
    'Explore six MakeHaven shops, gather materials, and make something with a gamepad.',
    windowWidth=1280, windowHeight=720, adaptGameResolutionAtRuntime=False,
    sizeOnStartupMode='', maxFPS=60, minFPS=20, antialiasingMode='none',
    playableDevices=['gamepad', 'keyboard'])
p['properties']['loadingScreen']['showGDevelopSplash'] = False
p['properties']['watermark']['showWatermark'] = False
(ROOT / 'game.json').write_text(json.dumps(p, separators=(',', ':')))
print('Built 8 scenes, 6 shop layouts, local resources, and shared gamepad gameplay.')
