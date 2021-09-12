# WECHATY PUPPET WHATSAPP

[![NPM Version](https://badge.fury.io/js/wechaty-puppet-whatsapp.svg)](https://badge.fury.io/js/wechaty-puppet-whatsapp)
[![npm (tag)](https://img.shields.io/npm/v/wechaty-puppet-whatsapp/next.svg)](https://www.npmjs.com/package/wechaty-puppet-whatsapp?activeTab=versions)
[![NPM](https://github.com/wechaty/wechaty-puppet-whatsapp/workflows/NPM/badge.svg)](https://github.com/wechaty/wechaty-puppet-whatsapp/actions?query=workflow%3ANPM)
[![ES Modules](https://img.shields.io/badge/ES-Modules-brightgreen)](https://github.com/Chatie/tsconfig/issues/16)

![wechaty puppet whatsapp](docs/images/wechaty-puppet-whatsapp.png)

[![Powered by Wechaty](https://img.shields.io/badge/Powered%20By-Wechaty-brightgreen.svg)](https://github.com/wechaty/wechaty)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)](https://www.typescriptlang.org/)

Puppet Whatsapp

## USAGE

### Puppet Whatsapp

```ts
import { Wechaty }   from 'wechaty'
import { PuppetWhatsapp } from 'wechaty-puppet-whatsapp'

const puppet  = new PuppetWhatsapp()
const wechaty = new Wechaty({ puppet })

wechaty.start()
```

## WECHATY GETTING STARTED

TL;DR:

```sh
export WECHATY_PUPPET=wechaty-puppet-whatsapp
npm start
```

Learn how to run Wechaty bot from <https://github.com/wechaty/wechaty-getting-started>

## HISTORY

### master v0.3

1. ES Modules support

### v0.2 (Feb 11, 2021)

1. Passed the perfect restart unit testing.

### v0.0.1 (Nov, 2020)

Initial version.

1. Kick-off PR from [@univerone](https://github.com/univerone) with ding-dong-bot enabled!

## SPECIAL THANKS

Wechaty Puppet Whatsapp is built on top of [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js), which is A WhatsApp client library for NodeJS that connects through the WhatsApp Web browser app, created by Pedro S. Lopez, [@pedroslopez](https://github.com/pedroslopez).

## MAINTAINERS

1. [@univerone](https://github.com/univerone) Shanshan JIANG
1. [@huan](https://github.com/huan) [Huan LI](http://linkedin.com/in/zixia) \<zixia@zixia.net\>

## COPYRIGHT & LICENSE

* Code & Docs © 2020-now Wechaty Contributors <https://github.com/wechaty>
* Code released under the Apache-2.0 License
* Docs released under Creative Commons
