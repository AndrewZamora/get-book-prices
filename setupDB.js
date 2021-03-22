const Datastore = require('nedb');
const csv = require('csv-parser');
const { createReadStream } = require('fs');

const db = {
  meta: new Datastore('meta.db'),
  books: new Datastore('books.db')
};

const dbPromise = (db, action, ...args) => {
  return new Promise((resolve, reject) => {
    db[action](...args, (err, data) => {
      if (err) {
        return reject(err);
      }
      resolve(data);
    });
  });
}

Object.keys(db).forEach(collection => db[collection].loadDatabase());

(async () => {
  await new Promise((resolve, reject) => {
    const stream = createReadStream('books.csv')
      .pipe(csv())
      .on('data', async data => {
        const { title, author, description } = data;
        try {
          stream.pause();
          await dbPromise(db.books, 'insert', { title, author, description });
          const [metaDoc] = await dbPromise(db.meta, 'find', {});
          await dbPromise(db.meta, 'update', { _id: metaDoc['_id'] }, { $inc: { bookCount: 1 } }, {});
        } finally {
          stream.resume();
        }
      })
      .on('end', async () => {
        resolve()
      });
  });
  // https://stackoverflow.com/questions/32038709/nedb-method-update-and-delete-creates-a-new-entry-instead-updating-existing-one
  db.meta.persistence.compactDatafile();
  // stream pause and resume seem to work with await but the method above seems to fire right before the readstream promise finishes because all extra documents are gone except one.
})();
