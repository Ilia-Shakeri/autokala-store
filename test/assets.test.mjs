import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve,sep} from 'node:path'
import {createHash} from 'node:crypto'
import images from '../src/product-images.json' with {type:'json'}
import {products} from '../server/seed.mjs'

test('all demo products use verified bounded local photographs with source and license',()=>{
  const base=resolve('public/products')+sep
  assert.equal(Object.keys(images).length,products.length)
  for(const product of products){const image=images[product.sku];assert.ok(image,product.sku);assert.match(image.src,/^\/products\/[a-z0-9-]+\.jpg$/);const path=resolve('public',`.${image.src}`);assert.ok(path.startsWith(base));const data=readFileSync(path);assert.ok(data.length>1000&&data.length<60*1024);assert.equal(data[0],0xff);assert.equal(data[1],0xd8);assert.equal(createHash('sha256').update(data).digest('hex'),image.sha256);assert.ok(image.width>0&&image.width<=640&&image.height>0&&image.height<=640);assert.match(image.sourceUrl,/^https:\/\//);assert.match(image.licenseUrl,/^https:\/\//);assert.ok(image.photographer&&image.license&&image.alt);assert.equal(image.illustrative,true)}
})
