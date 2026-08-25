import '/components/dimension_input3_widget.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'novo_produto_model.dart';
export 'novo_produto_model.dart';

class NovoProdutoWidget extends StatefulWidget {
  const NovoProdutoWidget({super.key});

  static String routeName = 'novoProduto';
  static String routePath = '/novoProduto';

  @override
  State<NovoProdutoWidget> createState() => _NovoProdutoWidgetState();
}

class _NovoProdutoWidgetState extends State<NovoProdutoWidget> {
  late NovoProdutoModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => NovoProdutoModel());

    _model.textController1 ??= TextEditingController();
    _model.textFieldFocusNode1 ??= FocusNode();

    _model.textController2 ??= TextEditingController();
    _model.textFieldFocusNode2 ??= FocusNode();

    _model.textController3 ??= TextEditingController();
    _model.textFieldFocusNode3 ??= FocusNode();

    WidgetsBinding.instance.addPostFrameCallback((_) => safeSetState(() {}));
  }

  @override
  void dispose() {
    _model.dispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: scaffoldKey,
      backgroundColor: FlutterFlowTheme.of(context).primaryBackground,
      body: Container(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: SingleChildScrollView(
            primary: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.start,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.max,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    FlutterFlowIconButton(
                      buttonSize: 40.0,
                      icon: Icon(
                        Icons.arrow_back_rounded,
                        color: FlutterFlowTheme.of(context).primaryText,
                        size: 24.0,
                      ),
                      onPressed: () {
                        print('IconButton pressed ...');
                      },
                    ),
                    Text(
                      'Novo Produto',
                      style: FlutterFlowTheme.of(context).titleLarge.override(
                            font: GoogleFonts.poppins(
                              fontWeight: FontWeight.bold,
                              fontStyle: FlutterFlowTheme.of(context)
                                  .titleLarge
                                  .fontStyle,
                            ),
                            color: FlutterFlowTheme.of(context).primaryText,
                            letterSpacing: 0.0,
                            fontWeight: FontWeight.bold,
                            fontStyle: FlutterFlowTheme.of(context)
                                .titleLarge
                                .fontStyle,
                          ),
                    ),
                    Container(
                      width: 48.0,
                    ),
                  ],
                ),
                Container(
                  height: 180.0,
                  decoration: BoxDecoration(
                    color: FlutterFlowTheme.of(context).secondaryBackground,
                    borderRadius: BorderRadius.circular(24.0),
                    border: Border.all(
                      color: FlutterFlowTheme.of(context).secondary,
                      width: 2.0,
                    ),
                  ),
                  alignment: AlignmentDirectional(0.0, 0.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.start,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.add_a_photo_rounded,
                        color: FlutterFlowTheme.of(context).primary,
                        size: 32.0,
                      ),
                      Text(
                        'Adicionar Fotos',
                        style: FlutterFlowTheme.of(context).labelLarge.override(
                              font: GoogleFonts.poppins(
                                fontWeight: FlutterFlowTheme.of(context)
                                    .labelLarge
                                    .fontWeight,
                                fontStyle: FlutterFlowTheme.of(context)
                                    .labelLarge
                                    .fontStyle,
                              ),
                              color: FlutterFlowTheme.of(context).primary,
                              letterSpacing: 0.0,
                              fontWeight: FlutterFlowTheme.of(context)
                                  .labelLarge
                                  .fontWeight,
                              fontStyle: FlutterFlowTheme.of(context)
                                  .labelLarge
                                  .fontStyle,
                            ),
                      ),
                    ].divide(SizedBox(height: 8.0)),
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.start,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _model.textController1,
                      focusNode: _model.textFieldFocusNode1,
                      obscureText: false,
                      decoration: InputDecoration(
                        labelText: 'Nome do Produto',
                        hintText: 'Ex: Smartphone Pro Max',
                      ),
                      style: TextStyle(),
                      maxLines: null,
                      validator:
                          _model.textController1Validator.asValidator(context),
                    ),
                    TextFormField(
                      controller: _model.textController2,
                      focusNode: _model.textFieldFocusNode2,
                      obscureText: false,
                      decoration: InputDecoration(
                        labelText: 'Descrição',
                        hintText: 'Detalhes do produto...',
                      ),
                      style: TextStyle(),
                      maxLines: 3,
                      validator:
                          _model.textController2Validator.asValidator(context),
                    ),
                    Text(
                      'Dimensões e Peso',
                      style: FlutterFlowTheme.of(context).titleMedium.override(
                            font: GoogleFonts.poppins(
                              fontWeight: FontWeight.w600,
                              fontStyle: FlutterFlowTheme.of(context)
                                  .titleMedium
                                  .fontStyle,
                            ),
                            color: FlutterFlowTheme.of(context).primaryText,
                            letterSpacing: 0.0,
                            fontWeight: FontWeight.w600,
                            fontStyle: FlutterFlowTheme.of(context)
                                .titleMedium
                                .fontStyle,
                          ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.max,
                      mainAxisAlignment: MainAxisAlignment.start,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          flex: 1,
                          child: wrapWithModel(
                            model: _model.dimensionInput3Model1,
                            updateCallback: () => safeSetState(() {}),
                            child: DimensionInput3Widget(
                              label: 'Altura (cm)',
                              hint: 0.0,
                            ),
                          ),
                        ),
                        Expanded(
                          flex: 1,
                          child: wrapWithModel(
                            model: _model.dimensionInput3Model2,
                            updateCallback: () => safeSetState(() {}),
                            child: DimensionInput3Widget(
                              label: 'Largura (cm)',
                              hint: 0.0,
                            ),
                          ),
                        ),
                      ].divide(SizedBox(width: 16.0)),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.max,
                      mainAxisAlignment: MainAxisAlignment.start,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          flex: 1,
                          child: wrapWithModel(
                            model: _model.dimensionInput3Model3,
                            updateCallback: () => safeSetState(() {}),
                            child: DimensionInput3Widget(
                              label: 'Comprimento (cm)',
                              hint: 0.0,
                            ),
                          ),
                        ),
                        Expanded(
                          flex: 1,
                          child: wrapWithModel(
                            model: _model.dimensionInput3Model4,
                            updateCallback: () => safeSetState(() {}),
                            child: DimensionInput3Widget(
                              label: 'Peso (kg)',
                              hint: 0.0,
                            ),
                          ),
                        ),
                      ].divide(SizedBox(width: 16.0)),
                    ),
                    TextFormField(
                      controller: _model.textController3,
                      focusNode: _model.textFieldFocusNode3,
                      obscureText: false,
                      decoration: InputDecoration(
                        labelText: 'Preço de Venda',
                        prefixIcon: Icon(
                          Icons.attach_money_rounded,
                        ),
                      ),
                      style: TextStyle(),
                      maxLines: null,
                      keyboardType: TextInputType.number,
                      validator:
                          _model.textController3Validator.asValidator(context),
                    ),
                  ].divide(SizedBox(height: 16.0)),
                ),
                FFButtonWidget(
                  onPressed: () {
                    print('Button pressed ...');
                  },
                  text: 'Salvar Produto',
                  options: FFButtonOptions(
                    width: double.infinity,
                    height: 56.0,
                    padding: EdgeInsetsDirectional.fromSTEB(0.0, 0.0, 0.0, 0.0),
                    iconPadding:
                        EdgeInsetsDirectional.fromSTEB(0.0, 0.0, 0.0, 0.0),
                    color: FlutterFlowTheme.of(context).primary,
                    textStyle: TextStyle(
                      color: FlutterFlowTheme.of(context).primaryBackground,
                      fontWeight: FontWeight.w600,
                      fontSize: 16.0,
                    ),
                    elevation: 0.0,
                    borderRadius: BorderRadius.circular(16.0),
                  ),
                ),
              ].divide(SizedBox(height: 24.0)),
            ),
          ),
        ),
      ),
    );
  }
}
