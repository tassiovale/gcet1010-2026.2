# gcet1010-2026.2

# 🏗️ Diretrizes Gerais do Projeto — Questify

Este documento reúne as diretrizes, os atributos de qualidade, as tecnologias consideradas e as alternativas arquiteturais discutidas durante o planejamento do Questify.

O objetivo é servir como **referência compartilhada entre as squads**, facilitando o alinhamento das decisões, a organização do código e a integração das diferentes partes do sistema.
---

## 📋 1. Atributos de Qualidade

### 🥇 1. Eficiência

**Objetivo:** garantir que o sistema execute suas operações de maneira eficiente, oferecendo respostas rápidas e utilizando adequadamente os recursos disponíveis.

**Diretrizes em discussão:**
- Considerar como referência inicial a atualização dos resultados do ranking em até **500 ms** após uma alteração que afete sua classificação.
- Avaliar a complexidade dos algoritmos utilizados, observando como o tempo de execução pode crescer conforme aumenta a quantidade de dados processados.
- Realizar revisões de código considerando o desempenho da lógica de negócio e das operações executadas.
- Analisar as consultas ao PostgreSQL, buscando evitar consultas desnecessárias, processamento redundante e gargalos no acesso aos dados.
- Considerar o volume de dados, a quantidade de usuários e as condições de execução ao avaliar o desempenho.

### 🥈 2. Segurança

**Objetivo:** proteger os dados dos usuários, impedir acessos não autorizados e transmitir confiança durante a utilização do sistema.

**Diretrizes em discussão:**
- Utilizar HTTPS para proteger a comunicação entre o navegador e o servidor por meio de criptografia TLS.
- Nunca armazenar senhas em texto puro; utilizar mecanismos apropriados de hash de senhas com parâmetros seguros.
- Definir requisitos adequados para a criação e a proteção das senhas.
- Controlar o acesso às funcionalidades e aos dados conforme as permissões de cada usuário.
- Evitar a exposição desnecessária de informações de login, contato e outros dados pessoais.
- Avaliar o uso de identificadores UUID/GUID para os usuários, considerando a integração entre serviços e a identificação dos registros.

### 🥉 3. Operabilidade

**Objetivo:** permitir que os usuários compreendam e utilizem as funcionalidades do sistema de maneira simples, direta e consistente.

**Diretrizes em discussão:**
- Utilizar como referência inicial a realização das operações previstas em, no máximo, três interações ou etapas de navegação, quando aplicável.
- Manter interfaces claras, com informações e ações fáceis de localizar.
- Evitar etapas desnecessárias para concluir tarefas comuns.
- Buscar consistência entre as telas e funcionalidades desenvolvidas pelas diferentes squads.
- Avaliar a facilidade de uso a partir dos fluxos reais dos usuários.

### 🏅 4. Modificabilidade

**Objetivo:** facilitar a manutenção e a evolução do sistema, reduzindo o impacto de alterações sobre funcionalidades que não estão diretamente relacionadas à mudança.

**Diretrizes em discussão:**
- Organizar o código com responsabilidades bem definidas.
- Evitar dependências desnecessárias entre componentes.
- Adotar convenções de nomenclatura e organização que facilitem a leitura do código por diferentes integrantes.
- Favorecer a manutenção independente das partes do sistema sempre que possível.
- Avaliar padrões arquiteturais que facilitem a substituição de componentes e a evolução das regras de negócio.

### 🎖️ 5. Adaptabilidade

**Objetivo:** permitir que o Questify seja utilizado em diferentes dispositivos e contextos de acesso, mantendo uma experiência adequada ao usuário.

**Diretrizes em discussão:**
- Desenvolver uma interface web responsiva.
- Considerar os dispositivos-alvo do projeto, incluindo celulares, tablets, notebooks e computadores de mesa.
- Adaptar a apresentação do conteúdo a diferentes tamanhos de tela e resoluções.
- Manter as principais funcionalidades acessíveis nos dispositivos suportados.
- Avaliar o comportamento das interfaces em diferentes resoluções durante os testes.

## 💻 2. Diretrizes Tecnológicas

### ☕ Linguagem de programação — Java

Java foi definida como linguagem comum para o desenvolvimento das partes do projeto, favorecendo a familiaridade entre os integrantes e a integração do trabalho das squads.

### 🍃 Framework — Spring

O Spring foi indicado como framework para o desenvolvimento da aplicação. O uso de suas ferramentas deverá considerar as necessidades de cada serviço e os padrões de organização adotados pelo projeto.

### 🐘 Banco de dados — PostgreSQL

O PostgreSQL foi indicado como banco de dados relacional do projeto.

Sua utilização deve considerar:
- A organização e a integridade dos dados.
- A definição adequada de tabelas, relacionamentos e restrições.
- A eficiência das consultas.
- A necessidade de transações para operações que exigem consistência.
- A segurança e o controle de acesso aos dados.

### 🌐 Front-end web — HTML, CSS e JavaScript

HTML, CSS e JavaScript compõem a base do desenvolvimento da interface web do projeto.

- **HTML:** estrutura o conteúdo das páginas.
- **CSS:** define a apresentação visual, o layout e os estilos.
- **JavaScript:** permite implementar interações e comportamentos dinâmicos.

### 🔐 HTTPS, certificados e servidores web

**HTTPS e TLS**
- HTTPS permite proteger a comunicação entre o navegador e o servidor por meio de TLS.
- Certificados TLS permitem autenticar a identidade do servidor e estabelecer a comunicação criptografada.
- A configuração deve considerar a validade e a renovação dos certificados.

**Nginx**
- Servidor web que também pode atuar como proxy reverso, encaminhando requisições aos serviços da aplicação.

**Apache HTTP Server (Apache2)**
- Servidor web que pode ser utilizado para disponibilizar conteúdo e encaminhar requisições conforme a configuração adotada.

**Certbot**
- Ferramenta que auxilia na obtenção e na renovação de certificados TLS, frequentemente utilizada para configurar HTTPS com autoridades certificadoras compatíveis.

Nginx e Apache2 são alternativas que podem cumprir funções semelhantes, embora também possam ser utilizados em conjunto em arquiteturas específicas. A escolha, assim como a utilização do Certbot e a configuração da infraestrutura, permanece sujeita à avaliação da equipe responsável.

---

## 🆔 3. Identificação de Usuários — UUID/GUID

**UUID** significa *Universally Unique Identifier*. É um padrão de identificador de 128 bits, normalmente representado por uma sequência semelhante a:

`550e8400-e29b-41d4-a716-446655440000`

**GUID** significa *Globally Unique Identifier* e é uma nomenclatura bastante utilizada no ecossistema Microsoft para identificadores desse tipo. Na prática, GUIDs são geralmente compatíveis com o formato UUID.

**Possíveis vantagens:**
- Reduzir a probabilidade de colisões entre identificadores.
- Permitir a geração de identificadores em diferentes serviços.
- Facilitar a integração entre componentes independentes.
- Evitar que identificadores sequenciais simples sejam expostos diretamente nas URLs.
---

## 🧩 4. Organização do Código e Arquitetura

### 🏗️ MVC — Model, View e Controller

MVC é um padrão de organização de software que separa responsabilidades relacionadas à interface, ao controle das solicitações e à representação dos dados.

- **Model (Modelo):** representa os dados e os conceitos utilizados pela aplicação, podendo incluir regras relacionadas ao domínio.
- **View (Visão):** apresenta informações ao usuário e permite a interação com o sistema.
- **Controller (Controlador):** recebe as solicitações e coordena o fluxo necessário para processá-las.

A separação dessas responsabilidades ajuda a manter o código organizado e facilita a compreensão das diferentes partes da aplicação.

### 🧱 MVC com Service, Repository e Model/Entities

Além dos componentes tradicionais do MVC, foi discutida uma estrutura que inclui Service e Repository. Essa organização é frequentemente descrita como uma arquitetura em camadas que utiliza MVC na camada de apresentação ou controle.

| Componente | Responsabilidade |
|---|---|
| **View** | Apresentar informações e permitir a interação do usuário. |
| **Controller** | Receber as solicitações e encaminhar o processamento. |
| **Service** | Concentrar ou coordenar as regras de negócio e as operações necessárias. |
| **Repository** | Intermediar o acesso aos dados persistidos, como consultas e gravações no banco. |
| **Model/Entities** | Representar os dados e as entidades do domínio da aplicação. |

**Exemplo genérico de funcionamento:**

1. A View permite que o usuário realize uma ação.
2. O Controller recebe a solicitação e encaminha o processamento.
3. O Service coordena a operação e aplica as regras necessárias.
4. O Repository consulta ou modifica os dados armazenados, utilizando as entidades pertinentes.
5. O resultado retorna pelas camadas até ser apresentado ao usuário.

Esse fluxo é ilustrativo. Model/Entities não representa necessariamente uma etapa sequencial depois do Repository: as entidades podem ser utilizadas por diferentes componentes durante o processamento.

### 🧠 DDD — Domain-Driven Design

DDD, ou *Domain-Driven Design*, é uma abordagem de desenvolvimento orientada ao domínio do negócio.

Seu objetivo é organizar o software a partir dos conceitos, das regras e dos relacionamentos que representam o problema que a aplicação precisa resolver.

**Ideia principal:** compreender o domínio e expressá-lo de maneira consistente no modelo e no código.

Essa abordagem pode ajudar a representar regras de negócio complexas e estabelecer uma linguagem comum entre os integrantes do projeto.

### 🧼 Clean Architecture — Arquitetura Limpa

Clean Architecture é uma abordagem de organização arquitetural que busca separar responsabilidades e controlar as dependências entre os componentes.

A proposta é manter as regras centrais do negócio independentes dos detalhes externos, como interfaces, frameworks e mecanismos de armazenamento.

**Ideia principal:** permitir que mudanças em tecnologias externas tenham o menor impacto possível sobre as regras principais da aplicação.

### 🔌 Arquitetura Hexagonal — Ports and Adapters

A Arquitetura Hexagonal, também chamada de *Ports and Adapters*, organiza a aplicação em torno de um núcleo de negócio que se comunica com o exterior por meio de portas e adaptadores.

- **Portas:** definem interfaces pelas quais o núcleo da aplicação se comunica com outros componentes.
- **Adaptadores:** implementam a comunicação com sistemas externos, como bancos de dados, APIs e interfaces de usuário.

**Ideia principal:** reduzir o acoplamento entre as regras de negócio e as tecnologias utilizadas para interagir com o ambiente externo.

### 🔎 Comparação entre as abordagens

| Abordagem | Foco principal |
|---|---|
| **MVC** | Separar a interface, o controle das solicitações e a representação dos dados. |
| **DDD** | Modelar o software de acordo com o domínio e as regras do negócio. |
| **Clean Architecture** | Organizar responsabilidades e controlar as dependências entre componentes. |
| **Arquitetura Hexagonal** | Isolar o núcleo da aplicação por meio de portas e adaptadores. |
---

## 🔍 5. Revisão de Código e Boas Práticas

**Pontos a considerar durante as revisões:**
- Clareza e organização do código.
- Separação adequada de responsabilidades.
- Complexidade dos algoritmos e crescimento do tempo de execução.
- Eficiência das consultas e operações no banco de dados.
- Existência de operações redundantes ou desnecessárias.
- Tratamento adequado de erros e situações inesperadas.
- Compatibilidade com as convenções e interfaces definidas para a integração.
- Facilidade para compreender, testar e modificar a implementação.
---

## 🤝 6. Padronização e Integração entre Squads

**Diretrizes gerais:**
- Manter consistência na linguagem de programação e nas convenções acordadas pelo grupo.
- Documentar as responsabilidades e as interfaces dos serviços.
- Definir padrões compatíveis para identificadores e estruturas de dados compartilhadas.
- Buscar clareza na organização dos diretórios, componentes e classes.
- Considerar os impactos de mudanças sobre outras partes do sistema.
- Registrar as decisões arquiteturais relevantes e atualizar a documentação quando houver mudanças.
- Avaliar as alternativas técnicas de acordo com as necessidades de cada squad, respeitando os requisitos e os padrões comuns do projeto.
---
