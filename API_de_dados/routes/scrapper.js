var express = require('express');
var router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const xml2js = require('xml2js');
const natural = require('natural');


/* GET home page. */
router.get('/continente', async function(req, res, next) {
  let url = "https://www.continente.pt/sitemap-custom_sitemap_1-product.xml";
  let lista_urls = [];
  let ids = [];

  axios.get('http://localhost:3000/products_info')
    .then(response => {
      // Acessar o array de objetos e mapear para pegar o id de cada objeto
      ids = response.data.map(product => String(product.id).trim());
      console.log("IDs:", ids);  // Verifique os ids recebidos do JSON Server
    })
    .catch(error => {
      console.error('Erro ao buscar os dados:', error);
    });

  // Aguardar o carregamento dos IDs
  await axios.get(url)
    .then(response => {
      const parser = new xml2js.Parser();
      parser.parseString(response.data, (err, result) => {
        if (err) {
          console.error("Erro ao parsear o XML:", err);
          return;
        }
        // Acessando as URLs dentro da estrutura XML convertida
        const urls = result.urlset.url;
        urls.forEach(item => {
          if (item.loc && item.loc[0]) {
            lista_urls.push(item.loc[0]);
          }
        });
      });
    })
    .catch(error => {
      console.error("Erro na requisição:", error);
    });

  let produtos = [];
  let i = 0;
  for (let url of lista_urls) {
    console.log(`${i}/${lista_urls.length}`);  // Mostrar qual URL está sendo processada
    i += 1;

    const idMatch = url.match(/(\d+).html/);
    let productId = 0;
    if (idMatch) {
      productId =  String(idMatch[1]).trim();
      //console.log(productId)
    }

    //console.log(`Extrair ID: ${productId}`);  // Verificar o ID extraído da URL

    if (productId && ids.includes(productId)) {
      console.log("ID encontrado na lista de IDs!");  // Confirmação de que está no `if`

      await axios.get(url)
        .then(resp => {
          console.log("Entrei no if");
          const $ = cheerio.load(resp.data);
          const productName = $('.pwc-h3.col-h3.product-name.pwc-font--primary-extrabold.mb-0')
            .text().trimStart().replace(/^\s/, '').trimEnd().replace(/\s$/, '');
          const productPrice = $('.ct-price-formatted').text().trimStart().replace(/^\s/, '')
            .trimEnd().replace(/\s$/, '').replace(/€/, '').replace(/,/, '.');

          if (productName && productPrice) {
            try {
              const product_obj = { "id": productId, "product_dsc": productName, "product_price": productPrice };
              const productStr = JSON.stringify(product_obj);
              const product = JSON.parse(productStr);
              produtos.push(product);
            }
            catch (error) {
              console.error("Erro ao processar o produto:", error);
            }
          }
        })
        .catch(error => {
          console.error("Erro ao acessar a URL do produto:", error);
        });
    } else {
      //console.log("ID não encontrado na lista de IDs ou não corresponde.");
    }
  }

  for (let produto of produtos) {
    let id = parseInt(produto.id);
    try {
      const resp = await axios.get(`http://localhost:3000/products_info/${id}`);
      let prod = resp.data;
      if (prod) {
        prod["product_price"] = produto.product_price;  // Corrigido o nome da variável
        await axios.put(`http://localhost:3000/products_info/${id}`, prod);
      }
    }
    catch (error) {
      console.error("Erro ao atualizar o produto:", error);
    }
  }

  res.status(200).send("Preços atualizados");
})

router.get('/continente/:id', async function(req, res, next) {
  start = req.params.id
  let url = `https://www.continente.pt/mercearia/?start${start}`;
  let produtos = []

  await axios.get(url)
    .then(resp => {
      const $ = cheerio.load(resp.data);
      $('.product').each((index, element) => {
        const productStr = $(element).find('div').attr('data-product-tile-impression');

        if (productStr) {
          try {
            const product = JSON.parse(productStr);
            produtos.push(product);
          }
          catch (error) {
          }
        }
      });
    })
    .catch(error => {
      console.log(error)
      res.render('error', {error: error})
    })
  for (let produto of produtos) {
      let id = parseInt(produto.id)
      try {
        const resp = await axios.get(`http://localhost:3000/products_info/${id}`)
        let prod = resp.data
        if (prod) {
          prod["product_price"] = produto.price
          console.log(id)
          await axios.put(`http://localhost:3000/products_info/${id}`, prod)
        }
      }
      catch (error) {
      }
  }
  res.status(200).send("")
});

// GET PRODUCTS
router.get('/produtos', function(req, res, next) {
  axios.get(`http://localhost:3000/products_info`)
  .then(resp => {
    res.status(200).jsonp(resp.data)
  })
  .catch(error => {
    console.log(error)
    res.render('error', {error: error})
  })
});

// GET PRODUCT
router.get('/produtos/:id', function(req, res, next) {
  axios.get(`http://localhost:3000/products_info/${req.params.id}`)
  .then(resp => {
    res.status(200).jsonp(resp.data)
  })
  .catch(error => {
    console.log(error)
    res.render('error', {error: error})
  })
});

// GET PRODUCTS nome e id
router.get('/produtos_info', function(req, res, next) {
  axios.get(`http://localhost:3000/products_info`)
  .then(resp => {
    const filteredProducts = resp.data.map(product => {
      return {
        id: product.id,
        product_dsc: product.product_dsc
      }
    })
    res.status(200).jsonp(filteredProducts)
  })
  .catch(error => {
    console.log(error)
    res.status(500).render('error', {error: error})
  })
});

// GET PRODUCT nome e id
router.get('/produtos_info/:id', function(req, res, next) {
  axios.get(`http://localhost:3000/products_info/${req.params.id}`)
  .then(resp => {
    if (resp.data.length == 1) {
      const product = resp.data[0]
      const filteredProduct = {
        id: product.id,
        product_dsc: product.product_dsc
      }
      res.status(200).jsonp(filteredProduct)
    }
    else {
      console.log("Produto não encontrado")
      res.status(404).render('error', {error: error})
    }
  })
  .catch(error => {
    console.log(error)
    res.status(500).render('error', {error: error})
  })
});

router.get('/minipreco/mercearia', async function(req, res, next) {
  step = 1
  total = 183
//  total = 1
  start = 0
  let url = `https://www.minipreco.pt/produtos/mercearia/c/WEB.003.000.00000?q=%3Arelevance&page=${start}&disp=2000`;
//  let produtos = []
  let id = 0

  const resp = await axios.get(`http://localhost:3000/products_info`)
  const produtosContinente_list = resp.data.map(product => product.product_dsc)
  let produtosContinente_map = {}
  resp.data.map(product => {
    produtosContinente_map[product.product_dsc] = product.id
  })

  while (start < total) {
    url = `https://www.minipreco.pt/produtos/mercearia/c/WEB.003.000.00000?q=%3Arelevance&page=${start}&disp=2000`;
    try {
      const resp = await axios.get(url);
      const $ = cheerio.load(resp.data);
      const productPromises = $('.product-list__item').map(async (index, element) => {
        const productName = $(element).find('.details').text().trimStart().replace(/^\s/, '');
        const productPrice = $(element).find('.price').text().trimStart().replace(/^\s/, '').replace(/€/, '').trimEnd().replace(/\s$/, '');

        console.log(id)
        if (productName && productPrice) {
          let bestMatch = null
          let highestScore = 0
          produtosContinente_list.forEach(item => {
            let itemContinente = item
            let similarity = natural.JaroWinklerDistance(productName.toUpperCase(), item.toUpperCase())
            if (similarity > highestScore) {
              highestScore = similarity
              bestMatch = itemContinente
            }
          })
          if (highestScore > 0.88) {
            try {
              let id_continente = produtosContinente_map[bestMatch]
              const respContinente = await axios.get(`http://localhost:3000/products_info/${id_continente}`)
              let product = respContinente.data
              product["preco_minipreco"] = productPrice
  //            const product_obj = {"id": id, "product_dsc": productName, "product_price": productPrice}
  //            const productStr = JSON.stringify(product_obj);
  //            const product = JSON.parse(productStr)
  //            console.log(product)
              await axios.put(`https://localhost:3000/products_info/${id_continente}`, product)
  //            produtos.push(product);
            }
            catch (error) {
              console.log("Erro: " + productName + " " + highestScore)
            }
          }
        }
        id += 1
      }).get()
      await Promise.all(productPromises);
    }
    catch (error) {
      console.log(error)
      res.render('error', {error: error})
    }
    start += step;
  }/*
  produtosMinipreco = {
    "minipreco": produtos
  }
  await axios.post(`http://localhost:3000/competicao`, produtosMinipreco)
    .then(resp => {
      console.log("Post realizado com sucesso")
      res.status(201).send("Post realizado com sucesso")
    })
    .catch(error => {
      console.log(error)
      res.render('error', {error: error})
    })*/
   res.status(200).send("")
});

router.get('/minipreco/:id', async function(req, res, next) {
});

router.get('/minipreco/continente', async function(req, res, next) {
  axios.get(`http://localhost:3000/products_info`)
  .then(resp => {
    res.status(200).jsonp(resp.data[0])
  })
  .catch(error => {
    console.log(error)
    res.render('error', {error: error})
  })
});

module.exports = router;
